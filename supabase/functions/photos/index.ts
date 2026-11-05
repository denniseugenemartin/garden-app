import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase, type SupabaseContext } from '@supabase/server';
import { AwsClient } from 'aws4fetch';

// Photos live in a private Cloudflare R2 bucket under gardens/<garden id>/. This function hands out
// short-lived signed links, and only for gardens the caller is a member of.

const R2_URL = `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${Deno.env.get('R2_BUCKET')}`;
const r2 = new AwsClient({
  service: 's3',
  region: 'auto',
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') ?? '',
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '',
});

const UPLOAD_EXPIRES_SECONDS = 10 * 60;
const VIEW_EXPIRES_SECONDS = 60 * 60;
const MAX_KEYS = 200;
// Storage limits. R2's free tier is 10 GB; past that Cloudflare bills automatically with no cap.
// App uploads are resized to ~0.2-0.5 MB; sampled NC State photos were all under 0.9 MB.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_PHOTO_LABEL = `${MAX_PHOTO_BYTES / 1024 / 1024} MB`;
const MAX_PHOTOS_PER_GARDEN = 1000;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024;
// Reference photos may only be copied from NC State's Plant Toolbox image bucket.
const IMPORT_HOST = 'eit-planttoolbox-prod.s3.amazonaws.com';
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY = new RegExp(`^gardens/(${UUID})/${UUID}\\.(jpg|png|webp)$`);

type Client = SupabaseContext['supabase'];
type AdminClient = SupabaseContext['supabaseAdmin'];

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** An error response if storing `bytes` more in this garden would pass a limit, otherwise null. */
async function checkLimits(admin: AdminClient, gardenId: string, bytes: number): Promise<Response | null> {
  if (bytes > MAX_PHOTO_BYTES) {
    return bad(`This photo is ${(bytes / 1024 / 1024).toFixed(1)} MB, over the ${MAX_PHOTO_LABEL} limit.`, 413);
  }
  const { data, error } = await admin.rpc('photo_usage', { target_garden: gardenId }).single();
  if (error) throw new Error(error.message);
  const usage = data as { garden_photos: number; total_bytes: number };
  if (usage.garden_photos >= MAX_PHOTOS_PER_GARDEN) {
    return bad(`This garden has reached its limit of ${MAX_PHOTOS_PER_GARDEN} photos.`, 403);
  }
  if (usage.total_bytes + bytes > MAX_TOTAL_BYTES) return bad('Photo storage is full.', 507);
  return null;
}

async function recordPhoto(admin: AdminClient, key: string, gardenId: string, bytes: number) {
  const { error } = await admin.from('photo_objects').insert({ key, garden_id: gardenId, bytes });
  if (error) throw new Error(error.message);
}

/** The subset of the given garden ids the caller belongs to (row level security filters the rest). */
async function memberGardens(supabase: Client, gardenIds: string[]): Promise<Set<string>> {
  if (gardenIds.length === 0) return new Set();
  const { data, error } = await supabase.from('gardens').select('id').in('id', gardenIds);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row: { id: string }) => row.id));
}

/** Valid keys in gardens the caller belongs to; everything else is dropped. */
async function allowedKeys(supabase: Client, keys: unknown): Promise<string[]> {
  if (!Array.isArray(keys)) return [];
  const valid = keys.filter((key): key is string => typeof key === 'string' && KEY.test(key)).slice(0, MAX_KEYS);
  const gardens = await memberGardens(supabase, [...new Set(valid.map((key) => key.match(KEY)![1]))]);
  return valid.filter((key) => gardens.has(key.match(KEY)![1]));
}

function newKey(gardenId: string, contentType: string): string {
  return `gardens/${gardenId}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`;
}

/** The image type from the file's first bytes; servers sometimes label images as generic downloads. */
function sniffImageType(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function signedUrl(
  key: string,
  method: 'GET' | 'PUT',
  expires: number,
  upload?: { contentType: string; bytes: number },
) {
  // Signing the upload's type and exact size means the link can't be used for anything bigger.
  const request = new Request(`${R2_URL}/${key}?X-Amz-Expires=${expires}`, {
    method,
    headers: upload
      ? { 'Content-Type': upload.contentType, 'Content-Length': String(upload.bytes) }
      : undefined,
  });
  const signed = await r2.sign(request, { aws: { signQuery: true, allHeaders: Boolean(upload) } });
  return signed.url.toString();
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      return await handle(req, ctx);
    } catch (error) {
      console.error(error);
      return bad((error as Error).message, 500);
    }
  }),
};

async function handle(req: Request, ctx: SupabaseContext): Promise<Response> {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return bad('Invalid request');

    switch (body.action) {
      // A link the app uploads one new photo to.
      case 'upload': {
        const { gardenId, contentType, bytes } = body;
        if (typeof gardenId !== 'string' || !EXTENSIONS[contentType] || !Number.isInteger(bytes) || bytes <= 0) {
          return bad('Invalid upload');
        }
        if (!(await memberGardens(ctx.supabase, [gardenId])).has(gardenId)) return bad('Not a member', 403);
        const overLimit = await checkLimits(ctx.supabaseAdmin, gardenId, bytes);
        if (overLimit) return overLimit;
        const key = newKey(gardenId, contentType);
        await recordPhoto(ctx.supabaseAdmin, key, gardenId, bytes);
        return Response.json({
          key,
          url: await signedUrl(key, 'PUT', UPLOAD_EXPIRES_SECONDS, { contentType, bytes }),
        });
      }

      // Links to display photos, keyed by photo key.
      case 'view': {
        const keys = await allowedKeys(ctx.supabase, body.keys);
        const urls: Record<string, string> = {};
        for (const key of keys) urls[key] = await signedUrl(key, 'GET', VIEW_EXPIRES_SECONDS);
        return Response.json({ urls, expiresIn: VIEW_EXPIRES_SECONDS });
      }

      // Copies an NC State reference photo into the garden, since NC State's links expire.
      case 'import': {
        const { gardenId, sourceUrl } = body;
        let source: URL;
        try {
          source = new URL(sourceUrl);
        } catch {
          return bad('Invalid source');
        }
        if (typeof gardenId !== 'string' || source.protocol !== 'https:' || source.hostname !== IMPORT_HOST) {
          return bad('Invalid source');
        }
        if (!(await memberGardens(ctx.supabase, [gardenId])).has(gardenId)) return bad('Not a member', 403);

        const upstream = await fetch(source, { redirect: 'error' }).catch(() => null);
        if (!upstream?.ok) {
          return bad("NC State's photo server didn't send the photo. Try again or pick a different one.", 502);
        }
        const declaredBytes = Number(upstream.headers.get('content-length'));
        if (declaredBytes > MAX_PHOTO_BYTES) {
          return bad(
            `This NC State photo is ${(declaredBytes / 1024 / 1024).toFixed(1)} MB, over the ${MAX_PHOTO_LABEL} limit. Pick a different one.`,
            413,
          );
        }
        const bytes = await upstream.arrayBuffer();
        const contentType = sniffImageType(new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength)));
        if (!contentType) return bad('That NC State photo isn’t a JPEG, PNG or WebP image. Pick a different one.', 415);
        const overLimit = await checkLimits(ctx.supabaseAdmin, gardenId, bytes.byteLength);
        if (overLimit) return overLimit;

        const key = newKey(gardenId, contentType);
        const put = await r2.fetch(`${R2_URL}/${key}`, {
          method: 'PUT',
          body: bytes,
          headers: { 'Content-Type': contentType },
        });
        if (!put.ok) return bad('Could not store that photo', 502);
        await recordPhoto(ctx.supabaseAdmin, key, gardenId, bytes.byteLength);
        return Response.json({ key });
      }

      case 'delete': {
        const requested = await allowedKeys(ctx.supabase, body.keys);
        // A journal photo can also be its plant's primary photo; keep anything still referenced.
        const inUse = new Set<string>();
        if (requested.length > 0) {
          for (const table of ['plants', 'journal_entries']) {
            const { data, error } = await ctx.supabaseAdmin.from(table).select('photo_key').in('photo_key', requested);
            if (error) throw new Error(error.message);
            for (const row of data ?? []) inUse.add(row.photo_key);
          }
        }
        const keys = requested.filter((key) => !inUse.has(key));
        await Promise.all(keys.map((key) => r2.fetch(`${R2_URL}/${key}`, { method: 'DELETE' })));
        if (keys.length > 0) await ctx.supabaseAdmin.from('photo_objects').delete().in('key', keys);
        return Response.json({ deleted: keys.length });
      }

      default:
        return bad('Unknown action');
    }
}
