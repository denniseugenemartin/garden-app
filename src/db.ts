import * as SQLite from 'expo-sqlite';
import type { ToolboxSection } from './ncstateDetails';

export type Plant = {
  id: number;
  commonName: string;
  scientificName: string | null;
  cultivar: string | null;
  location: string | null;
  acquiredOn: string | null;
  cycle: string | null;
  watering: string | null;
  sunlight: string | null;
  hardinessZone: string | null;
  notes: string | null;
  photoUri: string | null;
  referencePhotoUri: string | null;
  referencePhotoCredit: string | null;
  referencePhotoLicenseUrl: string | null;
  toolboxDescription: string | null;
  toolboxSections: ToolboxSection[] | null;
  toolboxSlug: string | null;
};

export type PlantDraft = Omit<Plant, 'id'>;

export type CatalogPlant = {
  slug: string;
  scientificName: string;
  commonNames: string[];
};

export type JournalEntry = {
  id: number;
  plantId: number;
  entryDate: string;
  text: string | null;
  photoUri: string | null;
};

type JournalRow = {
  id: number;
  plant_id: number;
  entry_date: string;
  text: string | null;
  photo_uri: string | null;
};

type Row = {
  id: number;
  common_name: string;
  scientific_name: string | null;
  cultivar: string | null;
  location: string | null;
  acquired_on: string | null;
  cycle: string | null;
  watering: string | null;
  sunlight: string | null;
  hardiness_zone: string | null;
  notes: string | null;
  photo_uri: string | null;
  reference_photo_uri: string | null;
  reference_photo_credit: string | null;
  reference_photo_license_url: string | null;
  toolbox_description: string | null;
  toolbox_sections: string | null;
  toolbox_slug: string | null;
};

type CatalogRow = { slug: string; scientific_name: string; common_names: string };

// Separator for common names in one column; never appears in a plant name.
const NAME_SEPARATOR = '\n';

let db: SQLite.SQLiteDatabase | null = null;
let initialized = false;

// Opened lazily: importing this module must have no native side effects,
// since Expo Router statically imports app/_layout.tsx outside the native runtime.
function getDb(): SQLite.SQLiteDatabase {
  if (!db) db = SQLite.openDatabaseSync('garden.db');
  return db;
}

export async function initDb(): Promise<void> {
  if (initialized) return;
  // Opening async first lets the web worker finish loading before sync calls block on it.
  db ??= await SQLite.openDatabaseAsync('garden.db');
  getDb().execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS plants (
      id INTEGER PRIMARY KEY NOT NULL,
      common_name TEXT NOT NULL,
      scientific_name TEXT,
      location TEXT,
      acquired_on TEXT,
      cycle TEXT,
      watering TEXT,
      sunlight TEXT,
      notes TEXT,
      photo_uri TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  try {
    getDb().execSync('ALTER TABLE plants ADD COLUMN cultivar TEXT');
  } catch {
    // Column already exists from a previous run.
  }
  try {
    getDb().execSync('ALTER TABLE plants ADD COLUMN hardiness_zone TEXT');
  } catch {
    // Column already exists from a previous run.
  }
  for (const column of [
    'reference_photo_uri',
    'reference_photo_credit',
    'reference_photo_license_url',
    'toolbox_description',
    'toolbox_sections',
    'toolbox_slug',
  ]) {
    try {
      getDb().execSync(`ALTER TABLE plants ADD COLUMN ${column} TEXT`);
    } catch {
      // Column already exists from a previous run.
    }
  }
  getDb().execSync(`
    CREATE TABLE IF NOT EXISTS catalog (
      slug TEXT PRIMARY KEY NOT NULL,
      scientific_name TEXT NOT NULL,
      common_names TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY NOT NULL,
      plant_id INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      text TEXT,
      photo_uri TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS journal_entries_plant ON journal_entries (plant_id, entry_date);
  `);
  initialized = true;
}

function toPlant(row: Row): Plant {
  return {
    id: row.id,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    cultivar: row.cultivar,
    location: row.location,
    acquiredOn: row.acquired_on,
    cycle: row.cycle,
    watering: row.watering,
    sunlight: row.sunlight,
    hardinessZone: row.hardiness_zone,
    notes: row.notes,
    photoUri: row.photo_uri,
    referencePhotoUri: row.reference_photo_uri,
    referencePhotoCredit: row.reference_photo_credit,
    referencePhotoLicenseUrl: row.reference_photo_license_url,
    toolboxDescription: row.toolbox_description,
    toolboxSections: row.toolbox_sections ? JSON.parse(row.toolbox_sections) : null,
    toolboxSlug: row.toolbox_slug,
  };
}

export function listPlants(): Plant[] {
  return getDb()
    .getAllSync<Row>('SELECT * FROM plants ORDER BY common_name COLLATE NOCASE')
    .map(toPlant);
}

export function getPlant(id: number): Plant | null {
  const row = getDb().getFirstSync<Row>('SELECT * FROM plants WHERE id = ?', id);
  return row ? toPlant(row) : null;
}

export function insertPlant(draft: PlantDraft): number {
  const result = getDb().runSync(
    `INSERT INTO plants
       (common_name, scientific_name, cultivar, location, acquired_on, cycle, watering, sunlight, hardiness_zone, notes, photo_uri, reference_photo_uri, reference_photo_credit, reference_photo_license_url, toolbox_description, toolbox_sections, toolbox_slug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    draft.commonName,
    draft.scientificName,
    draft.cultivar,
    draft.location,
    draft.acquiredOn,
    draft.cycle,
    draft.watering,
    draft.sunlight,
    draft.hardinessZone,
    draft.notes,
    draft.photoUri,
    draft.referencePhotoUri,
    draft.referencePhotoCredit,
    draft.referencePhotoLicenseUrl,
    draft.toolboxDescription,
    draft.toolboxSections ? JSON.stringify(draft.toolboxSections) : null,
    draft.toolboxSlug,
  );
  return result.lastInsertRowId;
}

export function updatePlant(id: number, draft: PlantDraft): void {
  getDb().runSync(
    `UPDATE plants SET
       common_name = ?, scientific_name = ?, cultivar = ?, location = ?, acquired_on = ?,
       cycle = ?, watering = ?, sunlight = ?, hardiness_zone = ?, notes = ?, photo_uri = ?,
       reference_photo_uri = ?, reference_photo_credit = ?, reference_photo_license_url = ?,
       toolbox_description = ?, toolbox_sections = ?, toolbox_slug = ?
     WHERE id = ?`,
    draft.commonName,
    draft.scientificName,
    draft.cultivar,
    draft.location,
    draft.acquiredOn,
    draft.cycle,
    draft.watering,
    draft.sunlight,
    draft.hardinessZone,
    draft.notes,
    draft.photoUri,
    draft.referencePhotoUri,
    draft.referencePhotoCredit,
    draft.referencePhotoLicenseUrl,
    draft.toolboxDescription,
    draft.toolboxSections ? JSON.stringify(draft.toolboxSections) : null,
    draft.toolboxSlug,
    id,
  );
}

export function deletePlant(id: number): void {
  getDb().withTransactionSync(() => {
    getDb().runSync('DELETE FROM journal_entries WHERE plant_id = ?', id);
    getDb().runSync('DELETE FROM plants WHERE id = ?', id);
  });
}

export function listJournalEntries(plantId: number): JournalEntry[] {
  return getDb()
    .getAllSync<JournalRow>(
      'SELECT * FROM journal_entries WHERE plant_id = ? ORDER BY entry_date DESC, id DESC',
      plantId,
    )
    .map((row) => ({
      id: row.id,
      plantId: row.plant_id,
      entryDate: row.entry_date,
      text: row.text,
      photoUri: row.photo_uri,
    }));
}

export function insertJournalEntry(entry: Omit<JournalEntry, 'id'>): void {
  getDb().runSync(
    'INSERT INTO journal_entries (plant_id, entry_date, text, photo_uri) VALUES (?, ?, ?, ?)',
    entry.plantId,
    entry.entryDate,
    entry.text,
    entry.photoUri,
  );
}

export function deleteJournalEntry(id: number): void {
  getDb().runSync('DELETE FROM journal_entries WHERE id = ?', id);
}

export function replaceCatalog(plants: CatalogPlant[]): void {
  const database = getDb();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM catalog');
    const insert = database.prepareSync(
      'INSERT OR REPLACE INTO catalog (slug, scientific_name, common_names) VALUES (?, ?, ?)',
    );
    try {
      for (const plant of plants) {
        insert.executeSync(plant.slug, plant.scientificName, plant.commonNames.join(NAME_SEPARATOR));
      }
    } finally {
      insert.finalizeSync();
    }
    database.runSync(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('catalog_synced_at', ?)",
      new Date().toISOString(),
    );
  });
}

export function getCatalogSyncedAt(): Date | null {
  const row = getDb().getFirstSync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'catalog_synced_at'",
  );
  return row ? new Date(row.value) : null;
}

function toCatalogPlant(row: CatalogRow): CatalogPlant {
  return {
    slug: row.slug,
    scientificName: row.scientific_name,
    commonNames: row.common_names ? row.common_names.split(NAME_SEPARATOR) : [],
  };
}

export function searchCatalog(query: string, limit = 50): CatalogPlant[] {
  const term = query.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const contains = `%${term}%`;
  const prefix = `${term}%`;
  return getDb()
    .getAllSync<CatalogRow>(
      `SELECT slug, scientific_name, common_names FROM catalog
       WHERE scientific_name LIKE ? ESCAPE '\\' OR common_names LIKE ? ESCAPE '\\'
       ORDER BY (scientific_name LIKE ? ESCAPE '\\' OR common_names LIKE ? ESCAPE '\\') DESC,
                scientific_name COLLATE NOCASE
       LIMIT ?`,
      contains,
      contains,
      prefix,
      prefix,
      limit,
    )
    .map(toCatalogPlant);
}

export function findCatalogSlug(scientificName: string): string | null {
  const row = getDb().getFirstSync<{ slug: string }>(
    'SELECT slug FROM catalog WHERE scientific_name = ? COLLATE NOCASE',
    scientificName.trim(),
  );
  return row?.slug ?? null;
}
