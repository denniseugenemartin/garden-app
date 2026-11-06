import type { ToolboxDetails, ToolboxSection } from './ncstateDetails';
import { deletePhotos, importNcStatePhoto, isNcStatePhotoUrl, isStoredPhoto, uploadPhoto } from './photoStorage';
import { supabase } from './supabase';

// photoUri holds a storage key once saved (see photoStorage.ts). Before saving it can hold a newly
// picked local photo or an NC State photo URL, which are stored on save.

export type PlantDraft = {
  commonName: string;
  scientificName: string | null;
  cultivar: string | null;
  location: string | null;
  acquiredOn: string | null;
  notes: string | null;
  // The plant's primary photo: the user's own, one of its journal photos, or from NC State.
  photoUri: string | null;
  // Set when the photo came from NC State, whose licenses require attribution.
  photoCredit: string | null;
  photoLicenseUrl: string | null;
  toolboxSlug: string | null;
  // NC State info as shown: the user's edited copy if they changed it, otherwise the shared data.
  toolboxDescription: string | null;
  toolboxSections: ToolboxSection[] | null;
  // On the wishlist instead of in the garden.
  wishlist: boolean;
};

export type Plant = PlantDraft & {
  id: string;
  // The shared, unedited NC State data for toolboxSlug.
  toolboxBase: ToolboxDetails | null;
};

export type JournalEntry = {
  id: string;
  plantId: string;
  entryDate: string;
  text: string | null;
  photoUri: string | null;
};

type PlantRow = {
  id: string;
  common_name: string;
  scientific_name: string | null;
  cultivar: string | null;
  location: string | null;
  acquired_on: string | null;
  notes: string | null;
  photo_key: string | null;
  photo_credit: string | null;
  photo_license_url: string | null;
  toolbox_slug: string | null;
  toolbox_overrides: ToolboxDetails | null;
  toolbox_plants: ToolboxDetails | null;
  wishlist: boolean;
};

type JournalRow = {
  id: string;
  plant_id: string;
  entry_date: string;
  text: string | null;
  photo_key: string | null;
};

const PLANT_COLUMNS = '*, toolbox_plants(description, sections)';

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

let gardenCache: { userId: string; gardenId: Promise<string> } | null = null;

/** The signed-in user's own garden, created for them at sign-up. */
export async function getGardenId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in');
  if (gardenCache?.userId !== userId) {
    const gardenId = (async () => {
      const garden = check(
        await supabase
          .from('gardens')
          .select('id')
          .eq('created_by', userId)
          .order('created_at')
          .limit(1)
          .single(),
      );
      return garden!.id as string;
    })();
    gardenCache = { userId, gardenId };
    gardenId.catch(() => (gardenCache = null));
    return gardenId;
  }
  return gardenCache.gardenId;
}

function toPlant(row: PlantRow): Plant {
  const base = row.toolbox_plants;
  const shown = row.toolbox_overrides ?? base;
  return {
    id: row.id,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    cultivar: row.cultivar,
    location: row.location,
    acquiredOn: row.acquired_on,
    notes: row.notes,
    photoUri: row.photo_key,
    photoCredit: row.photo_credit,
    photoLicenseUrl: row.photo_license_url,
    toolboxSlug: row.toolbox_slug,
    toolboxDescription: shown?.description ?? null,
    toolboxSections: shown?.sections ?? null,
    toolboxBase: base,
    wishlist: row.wishlist,
  };
}

/**
 * @param toolbox The NC State data the draft's toolbox fields were loaded from, or null if none
 *   loaded. Only the user's changes to it are stored; the shared copy lives in toolbox_plants.
 */
function toRow(draft: PlantDraft, toolbox: { slug: string; base: ToolboxDetails } | null) {
  const edited =
    toolbox !== null &&
    (draft.toolboxDescription !== toolbox.base.description ||
      JSON.stringify(draft.toolboxSections) !== JSON.stringify(toolbox.base.sections));
  return {
    common_name: draft.commonName,
    scientific_name: draft.scientificName,
    cultivar: draft.cultivar,
    location: draft.location,
    acquired_on: draft.acquiredOn,
    notes: draft.notes,
    photo_key: draft.photoUri,
    photo_credit: draft.photoCredit,
    photo_license_url: draft.photoLicenseUrl,
    toolbox_slug: toolbox?.slug ?? null,
    toolbox_overrides: edited
      ? { description: draft.toolboxDescription, sections: draft.toolboxSections ?? [] }
      : null,
    wishlist: draft.wishlist,
  };
}

/** Stores a photo picked since the draft was loaded, replacing it with its storage key. */
async function storePhoto(draft: PlantDraft): Promise<PlantDraft> {
  const { photoUri } = draft;
  if (!photoUri || isStoredPhoto(photoUri)) return draft;
  const gardenId = await getGardenId();
  try {
    const key = isNcStatePhotoUrl(photoUri)
      ? await importNcStatePhoto(photoUri, gardenId)
      : await uploadPhoto(photoUri, gardenId);
    return { ...draft, photoUri: key };
  } catch (error) {
    throw new Error(`The photo couldn't be saved: ${(error as Error).message}`);
  }
}

export async function listPlants(wishlist: boolean): Promise<Plant[]> {
  const rows = check(
    await supabase
      .from('plants')
      .select(PLANT_COLUMNS)
      .eq('garden_id', await getGardenId())
      .eq('wishlist', wishlist),
  ) as PlantRow[];
  const compare = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  // Plants without a scientific name go last, by common name.
  return rows.map(toPlant).sort((a, b) => {
    const sa = a.scientificName?.trim() ?? '';
    const sb = b.scientificName?.trim() ?? '';
    if (!sa !== !sb) return sa ? -1 : 1;
    return compare(sa, sb) || compare(a.commonName, b.commonName);
  });
}

/** Distinct places the garden's plants are planted, most-used first. */
export async function listLocations(): Promise<string[]> {
  const rows = check(
    await supabase
      .from('plants')
      .select('location')
      .eq('garden_id', await getGardenId())
      .eq('wishlist', false)
      .not('location', 'is', null),
  ) as { location: string }[];
  const byKey = new Map<string, { name: string; count: number }>();
  for (const { location } of rows) {
    const trimmed = location.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const entry = byKey.get(key) ?? { name: trimmed, count: 0 };
    entry.count++;
    byKey.set(key, entry);
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((entry) => entry.name);
}

export async function getPlant(id: string): Promise<Plant | null> {
  const row = check(await supabase.from('plants').select(PLANT_COLUMNS).eq('id', id).maybeSingle());
  return row ? toPlant(row as PlantRow) : null;
}

export async function insertPlant(
  draft: PlantDraft,
  toolbox: { slug: string; base: ToolboxDetails } | null,
): Promise<string> {
  const row = check(
    await supabase
      .from('plants')
      .insert({ ...toRow(await storePhoto(draft), toolbox), garden_id: await getGardenId() })
      .select('id')
      .single(),
  );
  return row!.id;
}

export async function updatePlant(
  id: string,
  draft: PlantDraft,
  toolbox: { slug: string; base: ToolboxDetails } | null,
): Promise<void> {
  const before = check(await supabase.from('plants').select('photo_key').eq('id', id).single());
  const stored = await storePhoto(draft);
  check(await supabase.from('plants').update(toRow(stored, toolbox)).eq('id', id));
  // The server keeps the old photo if a journal entry still uses it.
  if (before?.photo_key !== stored.photoUri) deletePhotos([before?.photo_key]);
}

/** Also deletes the plant's journal entries (cascades in the database) and all their photos. */
export async function deletePlant(id: string): Promise<void> {
  const plant = check(await supabase.from('plants').select('photo_key').eq('id', id).single());
  const entries = check(
    await supabase.from('journal_entries').select('photo_key').eq('plant_id', id),
  ) as { photo_key: string | null }[];
  check(await supabase.from('plants').delete().eq('id', id));
  deletePhotos([plant?.photo_key, ...entries.map((entry) => entry.photo_key)]);
}

export async function listJournalEntries(plantId: string): Promise<JournalEntry[]> {
  const rows = check(
    await supabase
      .from('journal_entries')
      .select('id, plant_id, entry_date, text, photo_key')
      .eq('plant_id', plantId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ) as JournalRow[];
  return rows.map((row) => ({
    id: row.id,
    plantId: row.plant_id,
    entryDate: row.entry_date,
    text: row.text,
    photoUri: row.photo_key,
  }));
}

export async function insertJournalEntry(entry: Omit<JournalEntry, 'id'>): Promise<void> {
  const photoKey = entry.photoUri ? await uploadPhoto(entry.photoUri, await getGardenId()) : null;
  check(
    await supabase.from('journal_entries').insert({
      plant_id: entry.plantId,
      entry_date: entry.entryDate,
      text: entry.text,
      photo_key: photoKey,
    }),
  );
}

export async function deleteJournalEntry(entry: JournalEntry): Promise<void> {
  check(await supabase.from('journal_entries').delete().eq('id', entry.id));
  deletePhotos([entry.photoUri]);
}
