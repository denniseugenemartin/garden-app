import { supabase } from './supabase';

export const HARDINESS_ZONES = Array.from({ length: 13 }, (_, i) => [`${i + 1}a`, `${i + 1}b`]).flat();

export type Profile = { displayName: string | null; hardinessZone: string | null };

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

export async function getProfile(): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, hardiness_zone')
    .eq('id', await userId())
    .single();
  if (error) throw new Error(error.message);
  return { displayName: data.display_name, hardinessZone: data.hardiness_zone };
}

export async function setHardinessZone(zone: string | null): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ hardiness_zone: zone })
    .eq('id', await userId());
  if (error) throw new Error(error.message);
}

/** Looks up the USDA zone for a US ZIP code using phzmapi.org (USDA 2023 map data). */
export async function lookupZoneByZip(zip: string): Promise<{ zone: string; temperatureRange: string }> {
  const response = await fetch(`https://phzmapi.org/${zip}.json`);
  if (response.status === 404) throw new Error(`No zone found for ZIP code ${zip}.`);
  if (!response.ok) throw new Error('The zone lookup is unavailable right now. Try again later.');
  const data = (await response.json()) as { zone?: string; temperature_range?: string };
  if (!data.zone || !HARDINESS_ZONES.includes(data.zone)) throw new Error(`No zone found for ZIP code ${zip}.`);
  return { zone: data.zone, temperatureRange: data.temperature_range ?? '' };
}
