import { FunctionsHttpError } from '@supabase/supabase-js';
import * as ImageManipulator from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Photo fields hold either a storage key ("gardens/<garden id>/<uuid>.jpg") once saved, or a local
// or remote URI for a photo picked in a form that hasn't been saved yet.

const KEY_PREFIX = 'gardens/';
const MAX_DIMENSION = 1600;
const VIEW_BATCH = 200;
// Fetch a new link when the cached one has less than this left.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function isStoredPhoto(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(KEY_PREFIX);
}

async function callPhotos<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('photos', { body });
  if (error) {
    // Show the function's own message (e.g. a storage limit) rather than a generic HTTP error.
    const details = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(details?.error ?? error.message);
  }
  return data as T;
}

async function shrink(uri: string): Promise<string> {
  let image = await ImageManipulator.ImageManipulator.manipulate(uri, {
    maxWidth: MAX_DIMENSION,
    maxHeight: MAX_DIMENSION,
  }).renderAsync();
  const longest = Math.max(image.width, image.height);
  if (longest > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longest;
    image = await ImageManipulator.ImageManipulator.manipulate(image)
      .resize({ width: Math.round(image.width * scale), height: null })
      .renderAsync();
  }
  const saved = await image.saveAsync({ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  return saved.uri;
}

/** Resizes a photo picked on this device and uploads it to the garden; returns its key. */
export async function uploadPhoto(localUri: string, gardenId: string): Promise<string> {
  const resized = await shrink(localUri);
  const blob = await (await fetch(resized)).blob();
  const { key, url } = await callPhotos<{ key: string; url: string }>({
    action: 'upload',
    gardenId,
    contentType: 'image/jpeg',
    bytes: blob.size,
  });
  const response = await fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
  if (!response.ok) throw new Error(`Photo upload failed (HTTP ${response.status})`);
  return key;
}

/** Copies an NC State Plant Toolbox photo into the garden (its own links expire); returns its key. */
export async function importReferencePhoto(sourceUrl: string, gardenId: string): Promise<string> {
  const { key } = await callPhotos<{ key: string }>({
    action: 'import',
    gardenId,
    sourceUrl,
  });
  return key;
}

/** Best-effort removal of stored photos that nothing refers to anymore. */
export function deletePhotos(values: (string | null | undefined)[]): void {
  const keys = values.filter(isStoredPhoto);
  if (keys.length > 0) callPhotos({ action: 'delete', keys }).catch(() => {});
}

const linkCache = new Map<string, { url: string; expiresAt: number }>();

async function getPhotoLinks(keys: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = keys.filter((key) => {
    const cached = linkCache.get(key);
    return !cached || cached.expiresAt - now < REFRESH_MARGIN_MS;
  });
  for (let i = 0; i < missing.length; i += VIEW_BATCH) {
    const { urls, expiresIn } = await callPhotos<{ urls: Record<string, string>; expiresIn: number }>({
      action: 'view',
      keys: missing.slice(i, i + VIEW_BATCH),
    });
    const expiresAt = Date.now() + expiresIn * 1000;
    for (const [key, url] of Object.entries(urls)) linkCache.set(key, { url, expiresAt });
  }
  return Object.fromEntries(
    keys.filter((key) => linkCache.has(key)).map((key) => [key, linkCache.get(key)!.url]),
  );
}

/** Returns a resolver from photo field values to displayable URIs (null while a link loads). */
export function usePhotoUris(values: (string | null | undefined)[]) {
  const keyList = [...new Set(values.filter(isStoredPhoto))].sort().join('\n');
  const [links, setLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!keyList) return;
    let cancelled = false;
    getPhotoLinks(keyList.split('\n'))
      .then((result) => !cancelled && setLinks(result))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [keyList]);

  return (value: string | null | undefined): string | null => {
    if (!value) return null;
    return isStoredPhoto(value) ? (links[value] ?? null) : value;
  };
}
