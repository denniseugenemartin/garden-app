import { FunctionsHttpError } from '@supabase/supabase-js';
import * as ImageManipulator from 'expo-image-manipulator';
import { findCatalogSlug } from './catalog';
import { supabase } from './supabase';

const MAX_DIMENSION = 1600;

export type Identification = {
  scientificName: string;
  commonNames: string[];
  family: string | null;
  score: number;
  /** The NC State Plant Toolbox page for this species, if it has one. */
  toolboxSlug: string | null;
};

async function toJpegBase64(uri: string): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  let image = await context.renderAsync();
  const longest = Math.max(image.width, image.height);
  if (longest > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longest;
    image = await ImageManipulator.ImageManipulator.manipulate(uri)
      .resize({ width: Math.round(image.width * scale), height: null })
      .renderAsync();
  }
  const saved = await image.saveAsync({ base64: true, compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
  if (!saved.base64) throw new Error("Couldn't read that photo.");
  return saved.base64;
}

/** Likely species for a plant photo, best match first. */
export async function identifyPlant(photoUri: string): Promise<Identification[]> {
  const body = /^https:\/\//.test(photoUri)
    ? { imageUrl: photoUri }
    : { image: await toJpegBase64(photoUri) };
  const { data, error } = await supabase.functions.invoke('identify', { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(details?.error ?? error.message);
  }
  const results = (data as { results: Omit<Identification, 'toolboxSlug'>[] }).results;
  return Promise.all(
    results.map(async (result) => ({
      ...result,
      toolboxSlug: await findCatalogSlug(result.scientificName).catch(() => null),
    })),
  );
}
