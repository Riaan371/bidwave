import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAppTheme, Colors } from '../lib/theme';
import { useThemeStore } from '../lib/theme-store';
import { getNotificationPermission, requestNotificationPermission } from '../lib/onesignal';

export default function Settings() {
  const { bg, card, border, ink, muted } = useAppTheme();
  const { theme, toggle } = useThemeStore();
  const [notifPerm, setNotifPerm] = useState('default');

  useEffect(() => {
    getNotificationPermission().then(setNotifPerm);
  }, []);

  const enableNotifs = async () => {
    const granted = await requestNotificationPermission();
    setNotifPerm(granted ? 'granted' : await getNotificationPermission());
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Settings',
        headerStyle: { backgroundColor: Colors.navy },
        headerTintColor: '#fff',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>‹</Text>
          </Pressable>
        ),
      }} />

      <View style={{ padding: 16 }}>
        <View style={[s.row, { backgroundColor: card, borderColor: border, marginBottom: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: ink }]}>Push Notifications</Text>
            <Text style={[s.sub, { color: muted }]}>
              {notifPerm === 'granted' ? '✅ Enabled — you\'ll get auction alerts' :
               notifPerm === 'denied' ? '🚫 Blocked — enable in browser site settings' :
               'Get notified about new and live auctions'}
            </Text>
          </View>
          {notifPerm === 'default' && (
            <Pressable onPress={enableNotifs} style={{ backgroundColor: Colors.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: Colors.navy, fontWeight: '700', fontSize: 13 }}>Enable</Text>
            </Pressable>
          )}
        </View>

        <View style={[s.row, { backgroundColor: card, borderColor: border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: ink }]}>Dark mode</Text>
            <Text style={[s.sub, { color: muted }]}>Easier on the eyes at night</Text>
          </View>
          <Switch value={theme === 'dark'} onValueChange={toggle} trackColor={{ true: Colors.gold }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 16 },
  label: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
});
