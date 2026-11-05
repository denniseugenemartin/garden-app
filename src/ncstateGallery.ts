import { toolboxPageUrl } from './ncstate';
import { decodeHtmlEntities } from './htmlEntities';

export type ToolboxPhoto = {
  thumbnailUrl: string;
  fullUrl: string;
  caption: string | null;
  photographer: string | null;
  licenseName: string | null;
  licenseUrl: string | null;
};

const IMG_TAG_PATTERN = /<img class="img-thumbnail modal_img"([\s\S]*?)\/>/g;

function attr(chunk: string, name: string): string | null {
  const match = chunk.match(new RegExp(`${name}="([^"]*)"`));
  return match ? decodeHtmlEntities(match[1]) : null;
}

/** Loads the NC State Plant Toolbox page and extracts its photo gallery (the API has no photo licenses). */
export async function fetchToolboxPhotos(slug: string): Promise<ToolboxPhoto[]> {
  const url = toolboxPageUrl(slug);
  let html: string;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    html = await response.text();
  } catch {
    return [];
  }

  const photos: ToolboxPhoto[] = [];
  for (const match of html.matchAll(IMG_TAG_PATTERN)) {
    const chunk = match[1];
    const thumbnailUrl = attr(chunk, 'src');
    const fullUrl = attr(chunk, 'data-downloadurl');
    if (!thumbnailUrl || !fullUrl) continue;

    // data-license is itself HTML: <a href='LICENSE_URL'>LICENSE_NAME</a>
    const licenseRaw = attr(chunk, 'data-license');
    const licenseMatch = licenseRaw?.match(/href='([^']+)'>([^<]+)</);

    photos.push({
      thumbnailUrl,
      fullUrl,
      caption: attr(chunk, 'data-caption'),
      photographer: attr(chunk, 'data-attrib'),
      licenseName: licenseMatch ? decodeHtmlEntities(licenseMatch[2]) : null,
      licenseUrl: licenseMatch?.[1] ?? null,
    });
  }
  return photos;
}
