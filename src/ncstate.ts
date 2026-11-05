const BASE_URL = 'https://plants.ces.ncsu.edu';
export const API_URL = `${BASE_URL}/api`;

export function toolboxPageUrl(slug: string): string {
  return `${BASE_URL}/plants/${slug}/`;
}

/** Deep link into the NC State Extension Gardener Plant Toolbox search. */
export function toolboxSearchUrl(query: string): string {
  return `${BASE_URL}/find_a_plant/?q=${encodeURIComponent(query)}`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toolboxPlantUrl(scientificName: string, cultivar?: string | null): string {
  const slug = slugify(cultivar ? `${scientificName} ${cultivar}` : scientificName);
  return `${BASE_URL}/plants/${slug}/`;
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Resolves the exact NC State plant page for a scientific name (+ optional cultivar):
 * tries the cultivar-specific page first, falls back to the base species page, then search.
 */
export async function resolveToolboxUrl(scientificName: string, cultivar?: string | null): Promise<string> {
  if (cultivar) {
    const cultivarUrl = toolboxPlantUrl(scientificName, cultivar);
    if (await urlExists(cultivarUrl)) return cultivarUrl;
  }
  const speciesUrl = toolboxPlantUrl(scientificName);
  if (await urlExists(speciesUrl)) return speciesUrl;
  return toolboxSearchUrl(cultivar ? `${scientificName} ${cultivar}` : scientificName);
}
