import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirmAction } from './confirm';
import { JournalEntry, deleteJournalEntry, insertJournalEntry, listJournalEntries } from './garden';
import { pickPhoto } from './photos';
import { usePhotoUris } from './photoStorage';
import { colors } from './theme';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function Journal({ plantId }: { plantId: string }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const canAdd = (text.trim().length > 0 || photoUri !== null) && !saving;
  const photoSrc = usePhotoUris((entries ?? []).map((entry) => entry.photoUri));

  const reload = useCallback(
    () =>
      listJournalEntries(plantId)
        .then(setEntries)
        .catch((e: Error) => setError(e.message)),
    [plantId],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  async function attachPhoto(fromCamera: boolean) {
    const uri = await pickPhoto(fromCamera);
    if (uri) setPhotoUri(uri);
  }

  async function addEntry() {
    if (!canAdd) return;
    setSaving(true);
    setError(null);
    try {
      await insertJournalEntry({ plantId, entryDate: today(), text: text.trim() || null, photoUri });
      setText('');
      setPhotoUri(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function removeEntry(entry: JournalEntry) {
    confirmAction('Delete entry', `Delete the entry from ${formatDate(entry.entryDate)}?`, 'Delete', async () => {
      try {
        await deleteJournalEntry(entry);
        await reload();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="What did you notice today?"
          placeholderTextColor={colors.muted}
          multiline
        />
        {photoUri && (
          <View>
            <Image source={{ uri: photoUri }} style={styles.preview} />
            <Pressable onPress={() => setPhotoUri(null)} hitSlop={8}>
              <Text style={styles.removePhoto}>Remove photo</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.row}>
          <Pressable style={styles.secondary} onPress={() => attachPhoto(true)}>
            <Text style={styles.secondaryText}>Take photo</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => attachPhoto(false)}>
            <Text style={styles.secondaryText}>Choose photo</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.primary, !canAdd && styles.disabled]} onPress={addEntry} disabled={!canAdd}>
          <Text style={styles.primaryText}>Add entry</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {entries === null ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>No entries yet. Log what you see — blooms, pests, growth, harvests.</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.entry}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryDate}>{formatDate(entry.entryDate)}</Text>
              <Pressable onPress={() => removeEntry(entry)} hitSlop={8}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
            {entry.text && <Text style={styles.entryText}>{entry.text}</Text>}
            {photoSrc(entry.photoUri) && (
              <Image source={{ uri: photoSrc(entry.photoUri)! }} style={styles.entryPhoto} />
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 16, paddingBottom: 48 },
  composer: { gap: 12 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 90,
    padding: 12,
    textAlignVertical: 'top',
  },
  preview: { borderRadius: 10, height: 180, width: '100%' },
  removePhoto: { color: colors.danger, fontSize: 13, marginTop: 6 },
  row: { flexDirection: 'row', gap: 12 },
  secondary: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  primary: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 14 },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  empty: { color: colors.muted, marginTop: 16, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 13 },
  loading: { marginTop: 16 },
  entry: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  entryHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  entryDate: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  deleteText: { color: colors.danger, fontSize: 13 },
  entryText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  entryPhoto: { borderRadius: 8, height: 220, width: '100%' },
});
