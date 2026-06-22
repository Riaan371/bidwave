import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { initOneSignal } from '../lib/onesignal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/auth-store';
import { useThemeStore } from '../lib/theme-store';

const queryClient = new QueryClient();

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const initialized = useAuthStore((s) => s.initialized);
  const theme = useThemeStore((s) => s.theme);
  const initTheme = useThemeStore((s) => s.init);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initOneSignal();
    initTheme();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile().finally(() => setReady(true));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadProfile();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!ready || !initialized) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color="#0B5FFF" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
