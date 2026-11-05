import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { catalogIsEmpty, catalogIsStale, downloadCatalog } from './catalog';
import { CatalogPlant, searchCatalog } from './db';
import { colors } from './theme';

type Props = {
  onSelect: (plant: CatalogPlant) => void;
};

type CatalogState = 'ready' | 'downloading' | 'failed';

export default function SpeciesSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [catalogState, setCatalogState] = useState<CatalogState>(() =>
    catalogIsEmpty() ? 'downloading' : 'ready',
  );

  useEffect(() => {
    if (catalogState === 'downloading') {
      downloadCatalog()
        .then(() => setCatalogState('ready'))
        .catch(() => setCatalogState('failed'));
    } else if (catalogState === 'ready' && catalogIsStale()) {
      // Refresh in the background; the existing catalog keeps working if this fails.
      downloadCatalog().catch(() => {});
    }
  }, [catalogState]);

  const term = query.trim();
  const results = useMemo(
    () => (catalogState === 'ready' && term.length >= 2 ? searchCatalog(term) : []),
    [catalogState, term],
  );

  function handleSelect(plant: CatalogPlant) {
    onSelect(plant);
    setQuery('');
  }

  return (
    <View>
      <TextInput
        style={[styles.input, query.length === 0 && styles.inputEmpty]}
        value={query}
        onChangeText={setQuery}
        placeholder="Search the NC State plant list…"
        placeholderTextColor={colors.placeholder}
        autoCorrect={false}
      />
      {catalogState === 'downloading' && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.message}>Downloading the NC State plant list…</Text>
        </View>
      )}
      {catalogState === 'failed' && (
        <Pressable onPress={() => setCatalogState('downloading')}>
          <Text style={styles.message}>
            Couldn't download the NC State plant list. <Text style={styles.retry}>Try again</Text>
          </Text>
        </Pressable>
      )}
      {catalogState === 'ready' && term.length >= 2 && results.length === 0 && (
        <Text style={styles.message}>No matches.</Text>
      )}
      {results.length > 0 && (
        <ScrollView style={styles.resultsBox} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {results.map((plant) => (
            <Pressable key={plant.slug} style={styles.result} onPress={() => handleSelect(plant)}>
              <Text style={styles.resultName}>{plant.commonNames[0] ?? plant.scientificName}</Text>
              <Text style={styles.resultSub}>{plant.scientificName}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: 12,
  },
  inputEmpty: { backgroundColor: colors.emptyInput, borderColor: colors.emptyInput },
  status: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  message: { color: colors.muted, marginTop: 8 },
  retry: { color: colors.accent, fontWeight: '600' },
  resultsBox: { maxHeight: 280, marginTop: 4 },
  result: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  resultName: { color: colors.text, fontSize: 16 },
  resultSub: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
});
