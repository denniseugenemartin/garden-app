import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

// Identifies a plant from a photo with the Pl@ntNet API, keeping the API key on the server.

const PLANTNET_URL = 'https://my-api.plantnet.org/v2/identify/all';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_RESULTS = 5;
// Photos already online can be fetched here (browsers can't read them for CORS reasons), but only
// from NC State's Plant Toolbox bucket and this app's photo storage.
const ALLOWED_HOSTS = new Set([
  'eit-planttoolbox-prod.s3.amazonaws.com',
  `${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
]);

type PlantNetResult = {
  score: number;
  species: { scientificNameWithoutAuthor: string; commonNames?: string[]; family?: { scientificNameWithoutAuthor?: string } };
};

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function fetchAllowed(value: unknown): Promise<Uint8Array | Response> {
  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    return bad('Invalid image');
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return bad('Invalid image');
  const response = await fetch(url, { redirect: 'error' }).catch(() => null);
  if (!response?.ok) return bad("Couldn't load that photo.", 502);
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) return bad('That photo is too large.', 413);
  return new Uint8Array(await response.arrayBuffer());
}

function imageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (String.fromCharCode(...bytes.slice(1, 4)) === 'PNG') return 'image/png';
  return null;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    const apiKey = Deno.env.get('PLANTNET_API_KEY');
    if (!apiKey) return bad('Plant identification is not set up.', 500);

    const body = await req.json().catch(() => null);
    let bytes: Uint8Array | null;
    if (typeof body?.image === 'string') {
      bytes = decodeBase64(body.image);
    } else if (typeof body?.imageUrl === 'string') {
      const fetched = await fetchAllowed(body.imageUrl);
      if (fetched instanceof Response) return fetched;
      bytes = fetched;
    } else {
      return bad('Invalid request');
    }
    if (!bytes || bytes.length === 0) return bad('Invalid image');
    if (bytes.length > MAX_IMAGE_BYTES) return bad('That photo is too large.', 413);
    const type = imageType(bytes);
    if (!type) return bad('Only JPEG and PNG photos can be identified.', 415);

    const form = new FormData();
    form.append('images', new Blob([bytes], { type }), type === 'image/png' ? 'plant.png' : 'plant.jpg');
    const url = `${PLANTNET_URL}?nb-results=${MAX_RESULTS}&lang=en&api-key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, { method: 'POST', body: form }).catch(() => null);
    if (!response) return bad("Couldn't reach the plant identification service.", 502);
    // Pl@ntNet answers 404 when it doesn't see a plant in the photo.
    if (response.status === 404) return Response.json({ results: [] });
    if (response.status === 429) return bad('Plant identification has hit its daily limit. Try again tomorrow.', 429);
    if (!response.ok) {
      console.error('Pl@ntNet error', response.status, await response.text().catch(() => ''));
      return bad("The plant identification service couldn't identify this photo.", 502);
    }

    const data = (await response.json()) as { results?: PlantNetResult[] };
    const results = (data.results ?? []).slice(0, MAX_RESULTS).map((result) => ({
      scientificName: result.species.scientificNameWithoutAuthor,
      commonNames: result.species.commonNames ?? [],
      family: result.species.family?.scientificNameWithoutAuthor ?? null,
      score: result.score,
    }));
    return Response.json({ results });
  }),
};
