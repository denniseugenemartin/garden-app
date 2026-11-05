import { useEffect, useState } from 'react';
import { PlantDraft, deletePlant, insertPlant, listPlants } from './garden';
import { fetchToolboxDetails } from './ncstateDetails';
import { fetchToolboxPhotos } from './ncstateGallery';
import { setHardinessZone } from './profile';
import { supabase } from './supabase';

type SamplePlant = Pick<PlantDraft, 'commonName' | 'scientificName' | 'location' | 'notes' | 'wishlist'> & {
  slug: string;
  daysAgo: number | null;
};

const SAMPLE_PLANTS: SamplePlant[] = [
  {
    slug: 'hydrangea-macrophylla',
    commonName: 'Bigleaf Hydrangea',
    scientificName: 'Hydrangea macrophylla',
    location: 'Front bed, by the porch',
    notes: 'Blooms came in blue this year. Try adding lime in the fall for pink.',
    wishlist: false,
    daysAgo: 400,
  },
  {
    slug: 'asclepias-exaltata',
    commonName: 'Poke Milkweed',
    scientificName: 'Asclepias exaltata',
    location: 'Pollinator patch, part shade',
    notes: 'Monarch caterpillars spotted in July!',
    wishlist: false,
    daysAgo: 120,
  },
  {
    slug: 'acer-palmatum',
    commonName: 'Japanese Maple',
    scientificName: 'Acer palmatum',
    location: 'Back yard, east corner',
    notes: null,
    wishlist: false,
    daysAgo: 900,
  },
  {
    slug: 'hydrangea-quercifolia',
    commonName: 'Oakleaf Hydrangea',
    scientificName: 'Hydrangea quercifolia',
    location: null,
    notes: 'Saw one at the arboretum. Great fall color.',
    wishlist: true,
    daysAgo: null,
  },
];

let seeding: Promise<void> = Promise.resolve();

/** Resolves once any demo sample data has been added, so lists don't load before it. */
export function demoSeeded(): Promise<void> {
  return seeding;
}

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function addSamplePlant(sample: SamplePlant): Promise<void> {
  const [details, photos] = await Promise.all([
    fetchToolboxDetails(sample.slug).catch(() => null),
    fetchToolboxPhotos(sample.slug).catch(() => []),
  ]);
  const photo = photos[0];
  const draft: PlantDraft = {
    commonName: sample.commonName,
    scientificName: sample.scientificName,
    cultivar: null,
    location: sample.location,
    acquiredOn: sample.daysAgo === null ? null : dateDaysAgo(sample.daysAgo),
    notes: sample.notes,
    photoUri: photo?.fullUrl ?? null,
    photoCredit: photo ? [photo.photographer, photo.licenseName].filter(Boolean).join(' · ') || null : null,
    photoLicenseUrl: photo?.licenseUrl ?? null,
    toolboxSlug: sample.slug,
    toolboxDescription: details?.description ?? null,
    toolboxSections: details?.sections ?? null,
    wishlist: sample.wishlist,
  };
  const toolbox = details ? { slug: sample.slug, base: details } : null;
  try {
    await insertPlant(draft, toolbox);
  } catch {
    // A failed photo import shouldn't lose the sample plant.
    await insertPlant({ ...draft, photoUri: null, photoCredit: null, photoLicenseUrl: null }, toolbox);
  }
}

/** Signs in as a temporary guest and fills the new garden with sample plants. */
export async function startDemo(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  seeding = Promise.all([
    ...SAMPLE_PLANTS.map((sample) => addSamplePlant(sample).catch(() => {})),
    setHardinessZone('7b').catch(() => {}),
  ]).then(() => {});
}

/** Deletes the demo garden's plants and photos, then signs the guest out. */
export async function leaveDemo(): Promise<void> {
  await seeding;
  const plants = (await Promise.all([listPlants(false), listPlants(true)])).flat();
  await Promise.all(plants.map((plant) => deletePlant(plant.id).catch(() => {})));
  await supabase.auth.signOut();
}

/** True while signed in as a demo guest. */
export function useIsDemo(): boolean {
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsDemo(!!data.session?.user.is_anonymous));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setIsDemo(!!session?.user.is_anonymous),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return isDemo;
}
