import { makeRedirectUri } from 'expo-auth-session';
import { Link, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { startDemo } from '../src/demo';
import { supabase } from '../src/supabase';
import { colors } from '../src/theme';

// Supabase's built-in mailer only reaches the project team; turn on once custom SMTP is configured.
const EMAIL_CODES_ENABLED = false;

const FEATURES = [
  'Keep every plant, photo and note in one place',
  'Growing info for 4,700+ plants',
  'A wishlist for what you want to grow next',
];

async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    // Full-page redirect; the client picks the session out of the URL on return.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  const redirectTo = makeRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  // Tokens come back in the URL fragment; errors may be in the query or the fragment.
  const url = new URL(result.url);
  const params = new URLSearchParams(url.hash.slice(1));
  url.searchParams.forEach((value, key) => params.set(key, value));
  const oauthError = params.get('error_description') ?? params.get('error');
  if (oauthError) throw new Error(oauthError);

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: params.get('access_token') ?? '',
    refresh_token: params.get('refresh_token') ?? '',
  });
  if (sessionError) throw sessionError;
}

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (error) setError(error.message);
    else setCodeSent(true);
  }

  // On success the auth listener in _layout switches to the garden screens.
  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
  }

  function changeEmail() {
    setCodeSent(false);
    setCode('');
    setError(null);
  }

  async function continueWithGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function tryDemo() {
    setBusy(true);
    setError(null);
    try {
      await startDemo();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Sign in', headerShown: false }} />
      <View style={styles.screen}>
        <View style={styles.hero}>
          <Image source={require('../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
          <Text style={styles.title} accessibilityRole="header">
            My Garden
          </Text>
          <Text style={styles.tagline}>A garden journal with expert growing info from NC State Extension.</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.feature}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
              busy && styles.buttonDisabled,
            ]}
            onPress={continueWithGoogle}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Image source={require('../assets/google-g.png')} style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.cardHint}>New here? Signing in creates your garden.</Text>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <Pressable
            style={({ pressed }) => [styles.demoButton, pressed && styles.googleButtonPressed, busy && styles.buttonDisabled]}
            onPress={tryDemo}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.demoButtonText}>Try the demo</Text>
          </Pressable>
          <Text style={styles.cardHint}>Look around with sample plants. No account needed.</Text>

      {!EMAIL_CODES_ENABLED ? null : !codeSent ? (
        <>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            onSubmitEditing={sendCode}
            editable={!busy}
          />
          <Text style={styles.hint}>We&apos;ll email you a sign-in code. No password needed.</Text>
          <Pressable
            style={[styles.button, (!email.trim() || busy) && styles.buttonDisabled]}
            onPress={sendCode}
            disabled={!email.trim() || busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.hint}>Enter the code we sent to {email.trim()}.</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
            placeholder="123456"
            placeholderTextColor={colors.placeholder}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
            onSubmitEditing={verifyCode}
            editable={!busy}
            autoFocus
          />
          <Pressable
            style={[styles.button, (!code || busy) && styles.buttonDisabled]}
            onPress={verifyCode}
            disabled={!code || busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
          <Pressable onPress={changeEmail} disabled={busy} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Use a different email</Text>
          </Pressable>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <Link href="/about" asChild>
          <Pressable hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>See how it works</Text>
          </Pressable>
        </Link>
        <Text style={styles.footer}>
          Plant information from the NC State Extension Gardener Plant Toolbox.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  screen: { alignSelf: 'center', gap: 24, maxWidth: 420, width: '100%' },
  hero: { alignItems: 'center', gap: 8 },
  logo: { borderRadius: 28, height: 120, marginBottom: 8, width: 120 },
  title: { color: colors.text, fontSize: 32, fontWeight: '700' },
  tagline: { color: colors.muted, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  features: { alignSelf: 'center', gap: 10 },
  feature: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  featureDot: { backgroundColor: colors.accent, borderRadius: 4, height: 8, width: 8 },
  featureText: { color: colors.text, fontSize: 15 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  cardHint: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  codeInput: { fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  hint: { fontSize: 14, color: colors.muted },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  googleButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  googleButtonPressed: { backgroundColor: colors.emptyInput },
  googleIcon: { height: 20, width: 20 },
  googleButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  divider: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 4 },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  dividerText: { color: colors.muted, fontSize: 13 },
  demoButton: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  demoButtonText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: colors.accent, fontSize: 14, textAlign: 'center', marginTop: 8 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
});
