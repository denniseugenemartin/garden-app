import type { Session } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { supabase } from '../src/supabase';
import { colors } from '../src/theme';

export default function RootLayout() {
  // undefined = still restoring the saved session.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!!session} redirectTo="/sign-in">
          <Stack.Screen name="index" options={{ title: 'My Garden' }} />
          <Stack.Screen name="plant/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!session} redirectTo="/">
          <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
        </Stack.Protected>
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack>
    </>
  );
}
