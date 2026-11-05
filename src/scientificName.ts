const CULTIVAR_PATTERN = /\s*['‘’"“”]([^'"‘’“”]+)['‘’"“”]\s*$/;

/** Splits a trailing quoted cultivar off a scientific name, e.g. `Hydrangea macrophylla 'Nikko Blue'`. */
export function parseScientificName(raw: string): { scientificName: string; cultivar: string | null } {
  const match = raw.match(CULTIVAR_PATTERN);
  if (!match) return { scientificName: raw.trim(), cultivar: null };
  return {
    scientificName: raw.slice(0, match.index).trim(),
    cultivar: match[1].trim(),
  };
}
