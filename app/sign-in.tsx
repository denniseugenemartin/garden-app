import { makeRedirectUri } from 'expo-auth-session';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../src/supabase';
import { colors } from '../src/theme';

// Supabase's built-in mailer only reaches the project team; turn on once custom SMTP is configured.
const EMAIL_CODES_ENABLED = false;

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

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Sign in' }} />
      <Text style={styles.title}>My Garden</Text>

      <Pressable
        style={[styles.googleButton, busy && styles.buttonDisabled]}
        onPress={continueWithGoogle}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.googleButtonText}>Continue with Google</Text>
      </Pressable>

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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 24, marginBottom: 12 },
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  googleButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: colors.accent, fontSize: 14, textAlign: 'center', marginTop: 8 },
  error: { color: colors.danger, fontSize: 14 },
});
