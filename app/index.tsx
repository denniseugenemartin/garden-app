import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PlantList from '../src/PlantList';
import { colors } from '../src/theme';

export default function PlantListScreen() {
  const router = useRouter();

  const navButton = (label: string, href: '/wishlist' | '/profile' | '/about', icon: React.ReactNode) => (
    <Pressable
      style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.iconBox}>{icon}</View>
      <Text style={styles.navLabel}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => null }} />
      <View style={styles.banner}>
        {navButton('Wishlist', '/wishlist', <Text style={[styles.glyph, styles.heart]}>♡</Text>)}
        {navButton(
          'Profile',
          '/profile',
          // Drawn to match the ⓘ glyph: a head and shoulders inside a circle.
          <View style={styles.profileIcon}>
            <View style={styles.profileHead} />
            <View style={styles.profileBody} />
          </View>,
        )}
        {navButton('About', '/about', <Text style={styles.glyph}>ⓘ</Text>)}
      </View>
      <PlantList wishlist={false} />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  navButton: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 64, paddingVertical: 8 },
  navButtonPressed: { backgroundColor: colors.emptyInput },
  iconBox: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },
  glyph: { color: colors.accent, fontSize: 28, lineHeight: 30 },
  // ♡ draws smaller than ⓘ at the same font size.
  heart: { fontSize: 38, lineHeight: 34 },
  navLabel: { color: colors.accent, fontSize: 12, fontWeight: '600', marginTop: 2 },
  profileIcon: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: 13,
    borderWidth: 2,
    height: 26,
    overflow: 'hidden',
    width: 26,
  },
  profileHead: { backgroundColor: colors.accent, borderRadius: 4.5, height: 9, marginTop: 3, width: 9 },
  profileBody: {
    backgroundColor: colors.accent,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    height: 12,
    marginTop: 2,
    width: 18,
  },
});
