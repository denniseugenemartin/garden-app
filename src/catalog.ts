import { getCatalogSyncedAt, replaceCatalog } from './db';
import { API_URL } from './ncstate';

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type ApiPlant = { slug: string; scientific_name: string };
type ApiPlantDetail = { scientific_name: string; commonname_set: string[] | null };

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NC State request failed (HTTP ${response.status})`);
  return (await response.json()) as T;
}

/** Downloads the full NC State Plant Toolbox plant list (slugs + common names) into the local catalog. */
export async function downloadCatalog(): Promise<void> {
  // all_plants has slugs but no common names; plant_detail_list has common names but no slugs.
  const [plants, details] = await Promise.all([
    fetchJson<ApiPlant[]>(`${API_URL}/all_plants/`),
    fetchJson<{ results: ApiPlantDetail[] }>(`${API_URL}/plant_detail_list/?limit=10000`),
  ]);
  const commonNames = new Map(details.results.map((d) => [d.scientific_name, d.commonname_set ?? []]));
  replaceCatalog(
    plants.map((plant) => ({
      slug: plant.slug,
      scientificName: plant.scientific_name,
      commonNames: commonNames.get(plant.scientific_name) ?? [],
    })),
  );
}

export function catalogIsEmpty(): boolean {
  return getCatalogSyncedAt() === null;
}

export function catalogIsStale(): boolean {
  const syncedAt = getCatalogSyncedAt();
  return syncedAt === null || Date.now() - syncedAt.getTime() > MAX_AGE_MS;
}
