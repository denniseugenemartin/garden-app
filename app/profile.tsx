import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { confirmAction } from '../src/confirm';
import { leaveDemo, useIsDemo } from '../src/demo';
import { HARDINESS_ZONES, Profile, getProfile, lookupZoneByZip, setHardinessZone } from '../src/profile';
import { supabase } from '../src/supabase';
import { colors } from '../src/theme';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDemo = useIsDemo();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zip, setZip] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((e: Error) => setError(e.message));
  }, []);

  const saveZone = (zone: string | null) => {
    if (!profile) return;
    const previous = profile.hardinessZone;
    setProfile({ ...profile, hardinessZone: zone });
    setError(null);
    setHardinessZone(zone).catch((e: Error) => {
      setProfile((p) => p && { ...p, hardinessZone: previous });
      setError(`Couldn't save your zone: ${e.message}`);
    });
  };

  const lookUp = async () => {
    setLookingUp(true);
    setLookupMessage(null);
    setError(null);
    try {
      const { zone, temperatureRange } = await lookupZoneByZip(zip);
      saveZone(zone);
      setLookupMessage(
        `ZIP ${zip} is zone ${zone}${temperatureRange ? ` (winter lows of ${temperatureRange} °F)` : ''}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLookingUp(false);
    }
  };

  const zipValid = /^\d{5}$/.test(zip);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Profile' }} />
      {!profile && !error && <ActivityIndicator style={styles.loading} color={colors.accent} />}
      {profile && (
        <>
          {profile.displayName && <Text style={styles.name}>{profile.displayName}</Text>}

          <Text style={styles.label}>Hardiness zone</Text>
          <Pressable
            style={styles.select}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Hardiness zone: ${profile.hardinessZone ?? 'not set'}. Change`}
          >
            <Text style={profile.hardinessZone ? styles.selectText : styles.selectPlaceholder}>
              {profile.hardinessZone ? `Zone ${profile.hardinessZone}` : 'Not set'}
            </Text>
            <Text style={styles.selectChevron}>▾</Text>
          </Pressable>

          <Text style={styles.subLabel}>Find your zone by ZIP code</Text>
          <View style={styles.zipRow}>
            <TextInput
              style={styles.zipInput}
              value={zip}
              onChangeText={(text) => setZip(text.replace(/\D/g, '').slice(0, 5))}
              placeholder="27701"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              maxLength={5}
              returnKeyType="search"
              onSubmitEditing={() => zipValid && !lookingUp && lookUp()}
              accessibilityLabel="ZIP code"
            />
            <Pressable
              style={[styles.button, (!zipValid || lookingUp) && styles.disabled]}
              disabled={!zipValid || lookingUp}
              onPress={lookUp}
              accessibilityRole="button"
            >
              {lookingUp ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Look up</Text>
              )}
            </Pressable>
          </View>
          {lookupMessage && <Text style={styles.help}>{lookupMessage}</Text>}
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={styles.signOut}
        onPress={() =>
          isDemo
            ? confirmAction(
                'Leave the demo?',
                'The sample garden and anything you added will be deleted.',
                'Leave demo',
                leaveDemo,
              )
            : confirmAction('Sign out?', 'You can sign back in any time.', 'Sign out', () => {
                supabase.auth.signOut();
              })
        }
        accessibilityRole="button"
      >
        <Text style={styles.signOutText}>{isDemo ? 'Leave demo' : 'Sign out'}</Text>
      </Pressable>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose your zone</Text>
            <ScrollView>
              {[null, ...HARDINESS_ZONES].map((zone) => {
                const selected = zone === (profile?.hardinessZone ?? null);
                return (
                  <Pressable
                    key={zone ?? 'none'}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => {
                      saveZone(zone);
                      setLookupMessage(null);
                      setPickerOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {zone ? `Zone ${zone}` : 'Not set'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16 },
  loading: { marginTop: 48 },
  error: { color: colors.danger, fontSize: 14, marginTop: 12 },
  name: { color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 16 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 6 },
  subLabel: { color: colors.muted, fontSize: 13, marginBottom: 6, marginTop: 16 },
  help: { color: colors.muted, fontSize: 13, marginTop: 8 },
  select: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectText: { color: colors.text, fontSize: 16 },
  selectPlaceholder: { color: colors.placeholder, fontSize: 16 },
  selectChevron: { color: colors.muted, fontSize: 16 },
  zipRow: { flexDirection: 'row', gap: 8 },
  zipInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: 16,
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  signOut: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 32,
    paddingVertical: 12,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    maxHeight: '70%',
    maxWidth: 320,
    paddingVertical: 8,
    width: '100%',
  },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '600', padding: 12 },
  option: { paddingHorizontal: 16, paddingVertical: 12 },
  optionSelected: { backgroundColor: colors.emptyInput },
  optionText: { color: colors.text, fontSize: 16 },
  optionTextSelected: { color: colors.accent, fontWeight: '600' },
});
