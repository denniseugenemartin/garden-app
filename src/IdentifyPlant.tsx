import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Identification, identifyPlant } from './identify';
import { colors } from './theme';

type Props = {
  photoUri: string;
  onSelect: (match: Identification) => void;
};

type State =
  | { status: 'idle' }
  | { status: 'identifying' }
  | { status: 'done'; matches: Identification[] }
  | { status: 'failed'; message: string };

/** Identifies the plant in a photo with Pl@ntNet and lets the user pick the best match. */
export default function IdentifyPlant({ photoUri, onSelect }: Props) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [identifiedUri, setIdentifiedUri] = useState<string | null>(null);

  // Results belong to the photo they came from; a new photo starts over.
  const current = identifiedUri === photoUri ? state : { status: 'idle' as const };

  async function identify() {
    setIdentifiedUri(photoUri);
    setState({ status: 'identifying' });
    try {
      setState({ status: 'done', matches: await identifyPlant(photoUri) });
    } catch (error) {
      setState({ status: 'failed', message: (error as Error).message });
    }
  }

  function choose(match: Identification) {
    onSelect(match);
    setState({ status: 'idle' });
  }

  if (current.status === 'idle') {
    return (
      <View style={styles.row}>
        <Pressable style={styles.secondary} onPress={identify} accessibilityRole="button">
          <Text style={styles.secondaryText}>Identify this plant</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>
          {current.status === 'identifying'
            ? 'Identifying…'
            : current.status === 'failed'
              ? current.message
              : current.matches.length === 0
                ? 'No plant found in this photo. Try a closer shot of a flower or leaf.'
                : 'Tap the best match'}
        </Text>
        {current.status === 'identifying' && <ActivityIndicator color={colors.accent} />}
      </View>

      {current.status === 'done' &&
        current.matches.map((match) => (
          <Pressable
            key={match.scientificName}
            style={styles.match}
            onPress={() => choose(match)}
            accessibilityRole="button"
          >
            <View style={styles.matchText}>
              <Text style={styles.matchName}>{match.commonNames[0] ?? match.scientificName}</Text>
              <Text style={styles.matchSub}>{match.scientificName}</Text>
              {match.toolboxSlug && <Text style={styles.ncState}>NC State info available</Text>}
            </View>
            <Text style={styles.score}>{Math.round(match.score * 100)}%</Text>
          </Pressable>
        ))}

      {current.status !== 'identifying' && (
        <View style={styles.footer}>
          <Text style={styles.credit}>Identification by Pl@ntNet</Text>
          <Pressable onPress={() => setState({ status: 'idle' })} hitSlop={8} accessibilityRole="button">
            <Text style={styles.dismiss}>
              {current.status === 'done' && current.matches.length > 0 ? 'None of these' : 'Close'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 12 },
  secondary: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  panelHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 4 },
  panelTitle: { color: colors.text, flex: 1, fontSize: 15 },
  match: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  matchText: { flex: 1 },
  matchName: { color: colors.text, fontSize: 16 },
  matchSub: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  ncState: { color: colors.accent, fontSize: 12, marginTop: 2 },
  score: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  credit: { color: colors.muted, fontSize: 12 },
  dismiss: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
