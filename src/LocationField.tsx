import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { listLocations } from './garden';
import { colors } from './theme';

const MAX_SUGGESTIONS = 6;

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/** Free-text location with the garden's existing locations offered as tappable suggestions. */
export default function LocationField({ value, onChange }: Props) {
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    listLocations()
      .then(setLocations)
      .catch(() => {});
  }, []);

  const typed = value.trim().toLowerCase();
  const matches = locations.filter((location) => {
    const key = location.toLowerCase();
    return key !== typed && key.includes(typed);
  });
  // Locations starting with the typed text rank above ones that merely contain it.
  const ranked = typed
    ? [
        ...matches.filter((location) => location.toLowerCase().startsWith(typed)),
        ...matches.filter((location) => !location.toLowerCase().startsWith(typed)),
      ]
    : matches;
  const suggestions = ranked.slice(0, MAX_SUGGESTIONS);
  const hidden = ranked.length - suggestions.length;

  return (
    <View>
      <TextInput
        style={[styles.input, value.length === 0 && styles.inputEmpty]}
        value={value}
        onChangeText={onChange}
        placeholder="Back bed, east fence…"
        placeholderTextColor={colors.placeholder}
      />
      {suggestions.length > 0 && (
        <View style={styles.chips}>
          {suggestions.map((location) => (
            <Pressable
              key={location}
              style={styles.chip}
              onPress={() => onChange(location)}
              accessibilityRole="button"
              accessibilityLabel={`Planted in ${location}`}
            >
              <Text style={styles.chipText}>{location}</Text>
            </Pressable>
          ))}
          {hidden > 0 && <Text style={styles.more}>+{hidden} more, type to narrow</Text>}
        </View>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderColor: colors.accent,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  chipText: { color: colors.accent, fontSize: 14 },
  more: { alignSelf: 'center', color: colors.muted, fontSize: 13 },
});
