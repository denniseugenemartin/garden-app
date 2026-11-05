import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Journal from '../../src/Journal';
import SpeciesSearch from '../../src/SpeciesSearch';
import ToolboxSections from '../../src/ToolboxSections';
import NcStatePhotoPicker from '../../src/NcStatePhotoPicker';
import { findCatalogSlug } from '../../src/catalog';
import { PlantDraft, deletePlant, getPlant, insertPlant, updatePlant } from '../../src/garden';
import { resolveToolboxUrl, slugify, toolboxPageUrl, toolboxSearchUrl } from '../../src/ncstate';
import { ToolboxDetails, fetchToolboxDetails } from '../../src/ncstateDetails';
import { ToolboxPhoto } from '../../src/ncstateGallery';
import { pickPhoto } from '../../src/photos';
import { usePhotoUris } from '../../src/photoStorage';
import { confirmAction } from '../../src/confirm';
import { parseScientificName } from '../../src/scientificName';
import { colors } from '../../src/theme';

const EMPTY: PlantDraft = {
  commonName: '',
  scientificName: null,
  cultivar: null,
  location: null,
  acquiredOn: null,
  notes: null,
  photoUri: null,
  referencePhotoUri: null,
  referencePhotoCredit: null,
  referencePhotoLicenseUrl: null,
  toolboxDescription: null,
  toolboxSections: null,
  toolboxSlug: null,
};

// A slug picked from search wins; otherwise match the scientific name against the NC State catalog.
async function resolveToolboxSlug(
  pickedSlug: string | null,
  scientificName: string | null,
): Promise<string | null> {
  if (pickedSlug) return pickedSlug;
  if (!scientificName) return null;
  const species = parseScientificName(scientificName).scientificName;
  return (
    (await findCatalogSlug(scientificName)) ?? (await findCatalogSlug(species)) ?? slugify(species)
  );
}

// Identifies the inputs NC State data was loaded for, so saved data isn't re-fetched on open.
function toolboxKey(pickedSlug: string | null, scientificName: string | null): string {
  return `${pickedSlug ?? ''}|${scientificName ?? ''}`;
}

type Loaded = { draft: PlantDraft; toolboxBase: ToolboxDetails | null };

export default function PlantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plantId = id === 'new' ? null : id;
  const [loaded, setLoaded] = useState<Loaded | null>(() =>
    plantId === null
      ? { draft: { ...EMPTY, acquiredOn: new Date().toISOString().slice(0, 10) }, toolboxBase: null }
      : null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (plantId === null) return;
    getPlant(plantId)
      .then((plant) => {
        if (!plant) {
          setLoadError('This plant no longer exists.');
          return;
        }
        const { id: _id, toolboxBase, ...draft } = plant;
        setLoaded({ draft, toolboxBase });
      })
      .catch((error: Error) => setLoadError(error.message));
  }, [plantId]);

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: 'Plant' }} />
        {loadError ? (
          <Text style={styles.syncError}>{loadError}</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }
  return <PlantForm plantId={plantId} initial={loaded} />;
}

function PlantForm({ plantId, initial }: { plantId: string | null; initial: Loaded }) {
  const router = useRouter();
  const isNew = plantId === null;

  const [draft, setDraft] = useState<PlantDraft>(initial.draft);
  // The shared NC State data the toolbox fields came from; saving stores only changes to it.
  const [toolboxBase, setToolboxBase] = useState<ToolboxDetails | null>(initial.toolboxBase);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openingToolbox, setOpeningToolbox] = useState(false);
  const [syncingToolbox, setSyncingToolbox] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('Plant');
  const extraRequestId = useRef(0);
  const [toolboxSlug, setToolboxSlug] = useState<string | null>(initial.draft.toolboxSlug);
  const toolboxLoadedFor = useRef<string | null>(
    initial.toolboxBase ? toolboxKey(initial.draft.toolboxSlug, initial.draft.scientificName) : null,
  );
  const pickedSlug = draft.toolboxSlug;
  const scientificName = draft.scientificName;
  const photoSrc = usePhotoUris([draft.photoUri, draft.referencePhotoUri]);

  useEffect(() => {
    const key = toolboxKey(pickedSlug, scientificName);
    if (key === toolboxLoadedFor.current) return;
    const id = ++extraRequestId.current;
    const timer = setTimeout(async () => {
      const slug = await resolveToolboxSlug(pickedSlug, scientificName);
      const details = slug ? await fetchToolboxDetails(slug) : null;
      if (id !== extraRequestId.current) return;
      toolboxLoadedFor.current = key;
      setToolboxSlug(slug);
      setToolboxBase(details);
      setDraft((current) => ({
        ...current,
        toolboxDescription: details?.description ?? null,
        toolboxSections: details?.sections ?? null,
      }));
    }, 600);
    return () => clearTimeout(timer);
  }, [pickedSlug, scientificName]);

  function set<K extends keyof PlantDraft>(key: K, value: string) {
    // commonName is non-nullable; every other field stores empty as null.
    const stored = value.length > 0 || key === 'commonName' ? value : null;
    setDraft((current) => ({
      ...current,
      [key]: stored,
      // A hand-edited scientific name no longer matches the plant picked from search.
      ...(key === 'scientificName' && { toolboxSlug: null }),
    }));
  }

  async function attachPhoto(fromCamera: boolean) {
    const uri = await pickPhoto(fromCamera);
    if (uri) setDraft((current) => ({ ...current, photoUri: uri }));
  }

  async function selectReferencePhoto(photo: ToolboxPhoto) {
    setPhotoPickerOpen(false);
    const credit = [photo.photographer, photo.licenseName].filter(Boolean).join(' · ') || null;
    setDraft((current) => ({
      ...current,
      referencePhotoUri: photo.fullUrl,
      referencePhotoCredit: credit,
      referencePhotoLicenseUrl: photo.licenseUrl,
    }));
  }

  async function save() {
    if (draft.commonName.trim().length === 0) {
      setSaveError('Give this plant a name before saving.');
      return;
    }
    // Allow pasting "Genus species 'Cultivar'" directly into the scientific name field.
    const parsed = draft.scientificName ? parseScientificName(draft.scientificName) : null;
    const cleaned = {
      ...draft,
      commonName: draft.commonName.trim(),
      scientificName: parsed?.scientificName ?? draft.scientificName,
      cultivar: draft.cultivar ?? parsed?.cultivar ?? null,
    };
    // Link the plant to NC State only once its data has loaded (the slug may be a guess).
    const toolbox = toolboxSlug && toolboxBase ? { slug: toolboxSlug, base: toolboxBase } : null;
    setSaving(true);
    setSaveError(null);
    try {
      if (plantId === null) {
        await insertPlant(cleaned, toolbox);
      } else {
        await updatePlant(plantId, cleaned, toolbox);
      }
      close();
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // A directly opened/refreshed web page has no history to go back to.
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function confirmDelete() {
    if (plantId === null) return;
    confirmAction('Delete plant', `Remove ${draft.commonName} from your garden?`, 'Delete', async () => {
      try {
        await deletePlant(plantId);
        close();
      } catch (error) {
        setSaveError((error as Error).message);
      }
    });
  }

  async function resyncToolbox() {
    const slug = toolboxSlug;
    if (!slug) return;
    setSyncingToolbox(true);
    setSyncError(null);
    const details = await fetchToolboxDetails(slug, true);
    setSyncingToolbox(false);
    if (!details) {
      setSyncError("Couldn't load this plant from NC State.");
      return;
    }
    setToolboxBase(details);
    setDraft((current) => ({
      ...current,
      toolboxDescription: details.description,
      toolboxSections: details.sections,
    }));
  }

  function confirmResync() {
    confirmAction(
      'Sync with NC State',
      'Replace the NC State info with the latest from the Plant Toolbox? Any edits you made to it will be lost.',
      'Sync',
      resyncToolbox,
    );
  }

  const toolboxQuery = draft.scientificName ?? draft.commonName;

  async function openToolbox() {
    // NC State data loaded for this slug, so its page exists.
    if (toolboxSlug && toolboxBase) {
      Linking.openURL(toolboxPageUrl(toolboxSlug));
      return;
    }
    if (!draft.scientificName) {
      Linking.openURL(toolboxSearchUrl(toolboxQuery));
      return;
    }
    setOpeningToolbox(true);
    try {
      const url = await resolveToolboxUrl(draft.scientificName, draft.cultivar);
      Linking.openURL(url);
    } finally {
      setOpeningToolbox(false);
    }
  }

  const saveButton = (
    <>
      <Pressable style={[styles.primary, saving && styles.disabled]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Save</Text>}
      </Pressable>
      {saveError && <Text style={styles.syncError}>{saveError}</Text>}
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Add plant' : draft.commonName || 'Plant',
          // Our own arrow so there's always a way home, even on a directly opened web page.
          headerLeft: () => (
            <Pressable
              onPress={close}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back to My Garden"
            >
              <Text style={styles.homeLink}>←</Text>
            </Pressable>
          ),
        }}
      />
      <SegmentedControl options={isNew ? NEW_PLANT_TABS : TABS} value={tab} onChange={setTab} />

      {tab === 'Journal' && plantId !== null && <Journal plantId={plantId} />}

      {tab === 'Plant' && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Look up a species</Text>
          <SpeciesSearch
            onSelect={(plant) =>
              setDraft((current) => ({
                ...current,
                commonName: plant.commonNames[0] ?? plant.scientificName,
                // Cultivar stays a manual field, so keep only the species part of the name.
                scientificName: parseScientificName(plant.scientificName).scientificName,
                toolboxSlug: plant.slug,
              }))
            }
          />

          <Field label="Name" value={draft.commonName} onChange={(v) => set('commonName', v)} />
          <Field
            label="Scientific name"
            value={draft.scientificName ?? ''}
            onChange={(v) => set('scientificName', v)}
            placeholder="Hydrangea macrophylla 'Nikko Blue'"
          />
          <Field
            label="Cultivar"
            value={draft.cultivar ?? ''}
            onChange={(v) => set('cultivar', v)}
            placeholder="Nikko Blue"
          />
          <Field
            label="Where it's planted"
            value={draft.location ?? ''}
            onChange={(v) => set('location', v)}
            placeholder="Back bed, east fence…"
          />
          <Field
            label="Planted / acquired"
            value={draft.acquiredOn ?? ''}
            onChange={(v) => set('acquiredOn', v)}
            placeholder="2026-04-12"
          />
          <Field
            label="Notes"
            value={draft.notes ?? ''}
            onChange={(v) => set('notes', v)}
            multiline
          />

          <Text style={styles.label}>Photo</Text>
          {photoSrc(draft.photoUri) && (
            <Image source={{ uri: photoSrc(draft.photoUri)! }} style={styles.preview} />
          )}
          <View style={styles.row}>
            <Pressable style={styles.secondary} onPress={() => attachPhoto(true)}>
              <Text style={styles.secondaryText}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => attachPhoto(false)}>
              <Text style={styles.secondaryText}>Choose photo</Text>
            </Pressable>
          </View>

          {toolboxSlug && (
            <>
              <Text style={styles.label}>Reference photo</Text>
              {photoSrc(draft.referencePhotoUri) && (
                <>
                  <Image source={{ uri: photoSrc(draft.referencePhotoUri)! }} style={styles.preview} />
                  {draft.referencePhotoCredit && (
                    <Pressable
                      onPress={() =>
                        draft.referencePhotoLicenseUrl && Linking.openURL(draft.referencePhotoLicenseUrl)
                      }
                    >
                      <Text style={styles.referenceCredit}>{draft.referencePhotoCredit}</Text>
                    </Pressable>
                  )}
                </>
              )}
              <Pressable style={styles.secondary} onPress={() => setPhotoPickerOpen(true)}>
                <Text style={styles.secondaryText}>Choose photo from NC State</Text>
              </Pressable>
            </>
          )}

          <View style={styles.actions}>{saveButton}</View>
          {!isNew && (
            <Pressable style={styles.delete} onPress={confirmDelete}>
              <Text style={styles.deleteText}>Delete plant</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {tab === 'Info' && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!draft.scientificName ? (
            <Text style={styles.empty}>
              Look up a species on the Plant tab to load its NC State Plant Toolbox info.
            </Text>
          ) : (
            <>
              <ToolboxSections
                description={draft.toolboxDescription}
                sections={draft.toolboxSections}
                onDescriptionChange={(toolboxDescription) =>
                  setDraft((current) => ({ ...current, toolboxDescription }))
                }
                onSectionsChange={(toolboxSections) =>
                  setDraft((current) => ({ ...current, toolboxSections }))
                }
              />
              <View style={[styles.row, styles.toolboxActions]}>
                <Pressable
                  style={styles.secondary}
                  onPress={confirmResync}
                  disabled={syncingToolbox}
                  accessibilityLabel="Sync with NC State Plant Toolbox"
                >
                  {syncingToolbox ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Text style={styles.secondaryText}>↻ Sync</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  onPress={openToolbox}
                  disabled={openingToolbox}
                  accessibilityLabel="Open in NC State Plant Toolbox"
                >
                  {openingToolbox ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Text style={styles.secondaryText}>Open in Toolbox ↗</Text>
                  )}
                </Pressable>
              </View>
              {syncError && <Text style={styles.syncError}>{syncError}</Text>}

              <View style={styles.actions}>{saveButton}</View>
            </>
          )}
        </ScrollView>
      )}

      {toolboxSlug && (
        <NcStatePhotoPicker
          visible={photoPickerOpen}
          slug={toolboxSlug}
          onSelect={selectReferencePhoto}
          onClose={() => setPhotoPickerOpen(false)}
        />
      )}
    </>
  );
}

const TABS = ['Plant', 'Info', 'Journal'] as const;
// Journal entries belong to a saved plant, so new plants don't get a Journal tab yet.
const NEW_PLANT_TABS = ['Plant', 'Info'] as const;
type Tab = (typeof TABS)[number];

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: readonly Tab[];
  value: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
};

function Field({ label, value, onChange, placeholder, multiline }: FieldProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, value.length === 0 && styles.inputEmpty, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 4, padding: 16, paddingBottom: 48 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: 12,
  },
  inputMultiline: { height: 110, textAlignVertical: 'top' },
  inputEmpty: { backgroundColor: colors.emptyInput, borderColor: colors.emptyInput },
  preview: { borderRadius: 10, height: 200, width: '100%' },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  secondary: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  referenceCredit: { color: colors.muted, fontSize: 12, marginTop: 6, textDecorationLine: 'underline' },
  toolboxActions: { marginTop: 16 },
  syncError: { color: colors.danger, fontSize: 13, marginTop: 8 },
  primary: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 16,
  },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  delete: { alignItems: 'center', paddingVertical: 20 },
  deleteText: { color: colors.danger, fontSize: 15 },
  actions: { marginTop: 24 },
  homeLink: { color: colors.accent, fontSize: 24, paddingHorizontal: 8 },
  empty: { color: colors.muted, marginTop: 32, textAlign: 'center' },
  segments: {
    backgroundColor: colors.border,
    borderRadius: 10,
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 3,
  },
  segment: { alignItems: 'center', borderRadius: 8, flex: 1, paddingVertical: 9 },
  segmentSelected: { backgroundColor: colors.surface },
  segmentText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  segmentTextSelected: { color: colors.text },
});
