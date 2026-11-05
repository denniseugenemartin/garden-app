import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import { parseToolboxPlant } from './parse.ts';

// Returns the shared NC State Plant Toolbox data for a plant, fetching and caching it in
// toolbox_plants on first use. Users can't write that table directly, so this does it for them.

const API_URL = 'https://plants.ces.ncsu.edu/api';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// "Sync" re-fetches from NC State at most this often per plant, shared across all users.
const REFRESH_AFTER_MS = 60 * 60 * 1000;
const COLUMNS = 'slug, scientific_name, description, sections, fetched_at';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const body = await req.json().catch(() => ({}));
    const slug = body?.slug;
    const refresh = body?.refresh === true;
    if (typeof slug !== 'string' || slug.length > 200 || !SLUG.test(slug)) {
      return Response.json({ error: 'Invalid slug' }, { status: 400 });
    }

    const { data: cached, error: readError } = await ctx.supabase
      .from('toolbox_plants')
      .select(COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    if (readError) return Response.json({ error: readError.message }, { status: 500 });

    const stale = cached !== null && Date.now() - Date.parse(cached.fetched_at) > REFRESH_AFTER_MS;
    if (cached && !(refresh && stale)) return Response.json(cached);

    let upstream: Response;
    try {
      upstream = await fetch(`${API_URL}/plants/${slug}/`);
    } catch {
      return cached ? Response.json(cached) : Response.json({ error: 'NC State unavailable' }, { status: 502 });
    }
    if (upstream.status === 404) return Response.json({ error: 'Not found' }, { status: 404 });
    if (!upstream.ok) {
      return cached ? Response.json(cached) : Response.json({ error: 'NC State unavailable' }, { status: 502 });
    }

    const { data, error } = await ctx.supabaseAdmin
      .from('toolbox_plants')
      .upsert({ slug, ...parseToolboxPlant(await upstream.json()), fetched_at: new Date().toISOString() })
      .select(COLUMNS)
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  }),
};
