import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PlantList from '../src/PlantList';
import { confirmAction } from '../src/confirm';
import { leaveDemo, useIsDemo } from '../src/demo';
import { colors } from '../src/theme';

export default function PlantListScreen() {
  const router = useRouter();
  const isDemo = useIsDemo();

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
      {isDemo && (
        <View style={styles.demoNotice}>
          <Text style={styles.demoText}>Demo mode — explore freely, nothing is kept.</Text>
          <Pressable
            onPress={() =>
              confirmAction(
                'Leave the demo?',
                'The sample garden and anything you added will be deleted.',
                'Leave demo',
                leaveDemo,
              )
            }
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.demoLink}>Leave demo</Text>
          </Pressable>
        </View>
      )}
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
  demoNotice: {
    alignItems: 'center',
    backgroundColor: '#FFF6D6',
    borderBottomColor: '#EADFB0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  demoText: { color: colors.text, flex: 1, fontSize: 13 },
  demoLink: { color: colors.accent, fontSize: 13, fontWeight: '600' },
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
