import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from './theme';

/** Header back arrow that always returns to the garden, even on a directly opened web page. */
export default function HomeButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back to My Garden"
    >
      <Text style={styles.arrow}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  arrow: { color: colors.accent, fontSize: 24, paddingHorizontal: 8 },
});
