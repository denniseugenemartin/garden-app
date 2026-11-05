import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

// Refreshes the shared NC State plant list (catalog_plants) when it's over a month old.
// The app calls this whenever species search opens; it does nothing while the list is fresh.

const API_URL = 'https://plants.ces.ncsu.edu/api';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 1000;

type ApiPlant = { slug: string; scientific_name: string };
type ApiPlantDetail = { scientific_name: string; commonname_set: string[] | null };

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NC State request failed (HTTP ${response.status})`);
  return (await response.json()) as T;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    const { data: newest, error: readError } = await ctx.supabase
      .from('catalog_plants')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) return Response.json({ error: readError.message }, { status: 500 });
    if (newest && Date.now() - Date.parse(newest.synced_at) < MAX_AGE_MS) {
      return Response.json({ refreshed: false, syncedAt: newest.synced_at });
    }

    // all_plants has slugs but no common names; plant_detail_list has common names but no slugs.
    let plants: ApiPlant[];
    let details: { results: ApiPlantDetail[] };
    try {
      [plants, details] = await Promise.all([
        fetchJson<ApiPlant[]>(`${API_URL}/all_plants/`),
        fetchJson<{ results: ApiPlantDetail[] }>(`${API_URL}/plant_detail_list/?limit=10000`),
      ]);
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 502 });
    }

    const commonNames = new Map(details.results.map((d) => [d.scientific_name, d.commonname_set ?? []]));
    const syncedAt = new Date().toISOString();
    const rows = plants
      .filter((plant) => plant.slug && plant.scientific_name)
      .map((plant) => {
        const names = commonNames.get(plant.scientific_name) ?? [];
        return {
          slug: plant.slug,
          scientific_name: plant.scientific_name,
          common_names: names,
          search_text: [plant.scientific_name, ...names].join('\n').toLowerCase(),
          synced_at: syncedAt,
        };
      });

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const { error } = await ctx.supabaseAdmin.from('catalog_plants').upsert(rows.slice(i, i + BATCH_SIZE));
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }
    // Plants NC State no longer lists weren't touched by this sync.
    const { error: pruneError } = await ctx.supabaseAdmin.from('catalog_plants').delete().lt('synced_at', syncedAt);
    if (pruneError) return Response.json({ error: pruneError.message }, { status: 500 });

    return Response.json({ refreshed: true, syncedAt, count: rows.length });
  }),
};
