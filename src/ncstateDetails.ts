import { supabase } from './supabase';

export type ToolboxSection = {
  title: string;
  rows: { label: string; values: string[] }[];
};

export type ToolboxDetails = {
  description: string | null;
  sections: ToolboxSection[];
};

/**
 * Loads a plant's NC State Plant Toolbox info through the toolbox-plant edge function, which caches
 * it for every user. `refresh` asks it to re-fetch from NC State. Returns null if it can't be loaded.
 */
export async function fetchToolboxDetails(slug: string, refresh = false): Promise<ToolboxDetails | null> {
  const { data, error } = await supabase.functions.invoke('toolbox-plant', { body: { slug, refresh } });
  if (error || !data) return null;
  return { description: data.description, sections: data.sections };
}
