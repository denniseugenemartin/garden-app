import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CatalogPlant, refreshCatalogIfStale, searchCatalog } from './catalog';
import { colors } from './theme';

type Props = {
  onSelect: (plant: CatalogPlant) => void;
};

type Search = { term: string; results: CatalogPlant[] | null; failed: boolean };

export default function SpeciesSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<Search>({ term: '', results: [], failed: false });

  useEffect(refreshCatalogIfStale, []);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCatalog(term)
        .then((results) => !cancelled && setSearch({ term, results, failed: false }))
        .catch(() => !cancelled && setSearch({ term, results: [], failed: true }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  // Only show results for what's typed now; anything else is still loading.
  const current = term.length >= 2 && search.term === term ? search : null;
  const results = current?.results ?? [];
  const searching = term.length >= 2 && current === null;

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
      {searching && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
      {current?.failed && <Text style={styles.message}>Couldn&apos;t search the NC State plant list.</Text>}
      {current && !current.failed && results.length === 0 && (
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
  resultsBox: { maxHeight: 280, marginTop: 4 },
  result: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  resultName: { color: colors.text, fontSize: 16 },
  resultSub: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
});
