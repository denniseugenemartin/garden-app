import { supabase } from './supabase';

// The NC State plant list lives in Supabase (catalog_plants), shared by everyone.

export type CatalogPlant = {
  slug: string;
  scientificName: string;
  commonNames: string[];
};

type CatalogRow = { slug: string; scientific_name: string; common_names: string[] };

function toCatalogPlant(row: CatalogRow): CatalogPlant {
  return { slug: row.slug, scientificName: row.scientific_name, commonNames: row.common_names };
}

let refreshRequested = false;

/** Asks the server to refresh the shared list if it's over a month old; at most once per app run. */
export function refreshCatalogIfStale(): void {
  if (refreshRequested) return;
  refreshRequested = true;
  supabase.functions.invoke('catalog-sync').catch(() => {
    refreshRequested = false;
  });
}

export async function searchCatalog(term: string): Promise<CatalogPlant[]> {
  const { data, error } = await supabase.rpc('search_catalog', { term });
  if (error) throw new Error(error.message);
  return (data as CatalogRow[]).map(toCatalogPlant);
}

/** The NC State slug for an exact scientific name match (case-insensitive), if there is one. */
export async function findCatalogSlug(scientificName: string): Promise<string | null> {
  const escaped = scientificName.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await supabase
    .from('catalog_plants')
    .select('slug')
    .ilike('scientific_name', escaped)
    .limit(1)
    .maybeSingle();
  return data?.slug ?? null;
}
