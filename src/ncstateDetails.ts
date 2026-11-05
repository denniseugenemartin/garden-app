import { API_URL } from './ncstate';
import { decodeHtmlEntities as decodeEntities } from './htmlEntities';

function htmlToText(html: string): string {
  const text = html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|li|ul)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return text
    .split('\n')
    .map((line) => decodeEntities(line))
    .filter((line) => line.length > 0)
    .join('\n');
}

type ApiPlant = Record<string, unknown>;

// Display groups and labels mirror the NC State plant page. Only listed API fields are shown,
// which keeps out internal/admin fields like `proofread` and `internal_comment`.
const SECTION_FIELDS: { title: string; fields: [key: string, label: string][] }[] = [
  {
    title: 'Attributes',
    fields: [
      ['commonname_set', 'Common Names'],
      ['phonetic_spelling', 'Phonetic Spelling'],
      ['genus', 'Genus'],
      ['species', 'Species'],
      ['family', 'Family'],
      ['life_cycle', 'Life Cycle'],
      ['propagation', 'Recommended Propagation Strategy'],
      ['origin', 'Country Or Region Of Origin'],
      ['distribution', 'Distribution'],
      ['wildlife_value', 'Wildlife Value'],
      ['edibility', 'Edibility'],
      ['uses', 'Uses'],
      ['dimensions', 'Dimensions'],
    ],
  },
  {
    title: 'Whole Plant Traits',
    fields: [
      ['plant_type', 'Plant Type'],
      ['leaf_characteristics', 'Woody Plant Leaf Characteristics'],
      ['habit', 'Habit/Form'],
      ['growth_rate', 'Growth Rate'],
      ['maintenance', 'Maintenance'],
      ['texture', 'Texture'],
      ['appendage', 'Appendage'],
      ['climbing_method', 'Climbing Method'],
    ],
  },
  {
    title: 'Cultural Conditions',
    fields: [
      ['light', 'Light'],
      ['soil_texture', 'Soil Texture'],
      ['soil_ph', 'Soil pH'],
      ['soil_drainage', 'Soil Drainage'],
      ['available_space_to_plant', 'Available Space To Plant'],
      ['nc_region', 'NC Region'],
      ['usda_zone', 'USDA Plant Hardiness Zone'],
    ],
  },
  {
    title: 'Fruit',
    fields: [
      ['fruit_color', 'Fruit Color'],
      ['fruit_value_to_gardener', 'Fruit Value To Gardener'],
      ['fruit_display_harvest_time', 'Display/Harvest Time'],
      ['fruit_type', 'Fruit Type'],
      ['fruit_length', 'Fruit Length'],
      ['fruit_width', 'Fruit Width'],
      ['fruit_description', 'Fruit Description'],
    ],
  },
  {
    title: 'Flowers',
    fields: [
      ['flower_color', 'Flower Color'],
      ['flower_inflorescence', 'Flower Inflorescence'],
      ['flower_value_to_gardener', 'Flower Value To Gardener'],
      ['flower_bloom_time', 'Flower Bloom Time'],
      ['flower_shape', 'Flower Shape'],
      ['flower_petals', 'Flower Petals'],
      ['flower_size', 'Flower Size'],
      ['flower_description', 'Flower Description'],
    ],
  },
  {
    title: 'Leaves',
    fields: [
      ['leaf_color', 'Leaf Color'],
      ['leaf_feel', 'Leaf Feel'],
      ['leaf_value_to_gardener', 'Leaf Value To Gardener'],
      ['leaf_fall_color', 'Deciduous Leaf Fall Color'],
      ['leaf_type', 'Leaf Type'],
      ['leaf_arrangement', 'Leaf Arrangement'],
      ['leaf_shape', 'Leaf Shape'],
      ['leaf_margin', 'Leaf Margin'],
      ['leaf_hairs_present', 'Hairs Present'],
      ['leaf_length', 'Leaf Length'],
      ['leaf_width', 'Leaf Width'],
      ['leaf_description', 'Leaf Description'],
    ],
  },
  {
    title: 'Bark',
    fields: [
      ['bark_color', 'Bark Color'],
      ['bark_attachment', 'Surface/Attachment'],
      ['bark_plate_shape', 'Bark Plate Shape'],
      ['bark_description', 'Bark Description'],
    ],
  },
  {
    title: 'Stem',
    fields: [
      ['stem_color', 'Stem Color'],
      ['stem_aromatic', 'Stem Is Aromatic'],
      ['stem_form', 'Stem Form'],
      ['stem_surface', 'Stem Surface'],
      ['stem_cross_section', 'Stem Cross Section'],
      ['stem_buds', 'Stem Buds'],
      ['stem_bud_terminal', 'Stem Bud Terminal'],
      ['stem_bud_scales', 'Stem Bud Scales'],
      ['stem_leaf_scar_shape', 'Stem Leaf Scar Shape'],
      ['stem_lenticels', 'Stem Lenticels'],
      ['stem_pith', 'Stem Pith'],
      ['stem_description', 'Stem Description'],
    ],
  },
  {
    title: 'Landscape',
    fields: [
      ['landscape_location', 'Landscape Location'],
      ['landscape_theme', 'Landscape Theme'],
      ['design_feature', 'Design Feature'],
      ['attracts', 'Attracts'],
      ['resistance_to_challenges', 'Resistance To Challenges'],
      ['problems', 'Problems'],
      ['fire_risk', 'Fire Risk Rating'],
    ],
  },
  {
    title: 'Poisonous to Humans',
    fields: [
      ['poison_severity', 'Poison Severity'],
      ['poison_part', 'Poisonous Parts'],
      ['poison_symptoms', 'Poison Symptoms'],
      ['poison_toxic_principle', 'Poison Toxic Principle'],
      ['poison_dermatitis', 'Causes Contact Dermatitis'],
    ],
  },
];

function formatInches(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rest = inches % 12;
  return rest === 0 ? `${feet} ft.` : `${feet} ft. ${rest} in.`;
}

function formatRange(label: string, min: unknown, max: unknown): string | null {
  if (typeof min !== 'number' && typeof max !== 'number') return null;
  const parts = [min, max].filter((v): v is number => typeof v === 'number').map(formatInches);
  return `${label}: ${[...new Set(parts)].join(' - ')}`;
}

/** Normalizes an API field to display values; skips empty values and non-text shapes. */
function toValues(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list
    .filter((item): item is string => typeof item === 'string')
    .map((item) => decodeEntities(item))
    .filter((item) => item.length > 0);
}

function buildSections(plant: ApiPlant): ToolboxSection[] {
  const derived: ApiPlant = {
    ...plant,
    dimensions: [
      formatRange('Height', plant.height_min, plant.height_max),
      formatRange('Width', plant.width_min, plant.width_max),
    ],
  };
  return SECTION_FIELDS.map(({ title, fields }) => ({
    title,
    rows: fields
      .map(([key, label]) => ({ label, values: toValues(derived[key]) }))
      .filter((row) => row.values.length > 0),
  })).filter((section) => section.rows.length > 0);
}

export type ToolboxSection = {
  title: string;
  rows: { label: string; values: string[] }[];
};

export type ToolboxDetails = {
  description: string | null;
  sections: ToolboxSection[];
};

/** Loads a plant's details from the NC State Plant Toolbox API. Returns null if it can't be loaded. */
export async function fetchToolboxDetails(slug: string): Promise<ToolboxDetails | null> {
  let plant: ApiPlant;
  try {
    const response = await fetch(`${API_URL}/plants/${encodeURIComponent(slug)}/`);
    if (!response.ok) return null;
    plant = (await response.json()) as ApiPlant;
  } catch {
    return null;
  }

  const description = typeof plant.description === 'string' ? htmlToText(plant.description) : '';
  return {
    description: description || null,
    sections: buildSections(plant),
  };
}
