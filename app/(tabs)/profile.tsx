import { View, Text, Pressable, Switch, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/auth-store';
import { useThemeStore } from '../../lib/theme-store';
import { supabase } from '../../lib/supabase';


function SessionLotNames({ lotIds, ink, muted }: { lotIds: string[]; ink: string; muted: string }) {
  const { data: lots } = useQuery({
    queryKey: ['profile-session-lots', lotIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase.from('lots').select('id, title').in('id', lotIds);
      return data ?? [];
    },
    enabled: lotIds.length > 0,
  });
  if (!lots?.length) return null;
  return (
    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.15)' }}>
      <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lots on the block</Text>
      {lots.map((l, i) => (
        <Text key={l.id} style={{ color: ink, fontSize: 12, marginBottom: 2 }}>{i + 1}. {l.title}</Text>
      ))}
    </View>
  );
}

function AuctioneerPanel({ userId, ink, muted, card, border }: { userId: string; ink: string; muted: string; card: string; border: string }) {
  const queryClient = useQueryClient();

  const { data: sessions, refetch } = useQuery({
    queryKey: ['my-sessions', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('id, title, status, scheduled_at, lot_ids')
        .eq('auctioneer_id', userId)
        .in('status', ['scheduled', 'live'])
        .order('scheduled_at', { ascending: true });
      return data ?? [];
    },
  });

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from('live_sessions').delete().eq('id', id);
    if (error) { Alert.alert('Error', error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['scheduled-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
    refetch();
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable onPress={() => router.push('/manage-lots')} style={[s.btn, { backgroundColor: '#0B5FFF', marginBottom: 12 }]}>
        <Text style={[s.btnText, { color: '#fff' }]}>📦 Manage Lots</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/schedule-live')} style={[s.btn, { backgroundColor: '#DC2626', marginBottom: 12 }]}>
        <Text style={[s.btnText, { color: '#fff' }]}>🔴 Schedule / Go Live</Text>
      </Pressable>

      {sessions && sessions.length > 0 && (
        <View style={[{ borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 }, { borderColor: border, backgroundColor: card }]}>
          <Text style={{ color: ink, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>Scheduled Sessions</Text>
          {sessions.map((s2) => {
            const dt = s2.scheduled_at ? new Date(s2.scheduled_at) : null;
            const dateStr = dt ? dt.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }) + ' at ' + dt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : 'Live now';
            return (
              <View key={s2.id} style={{ borderWidth: 1, borderColor: border, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: ink, fontWeight: '700', fontSize: 14 }}>{s2.title ?? 'Untitled'}</Text>
                    <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600', marginTop: 2 }}>📅 {dateStr}</Text>
                  </View>
                  <Pressable onPress={() => deleteSession(s2.id)} style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(220,38,38,0.1)', borderRadius: 8, marginLeft: 8 }}>
                    <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>Delete</Text>
                  </Pressable>
                </View>
                {s2.lot_ids && s2.lot_ids.length > 0 && (
                  <SessionLotNames lotIds={s2.lot_ids} ink={ink} muted={muted} />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function Profile() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const dark = theme === 'dark';

  const bg = dark ? '#09090b' : '#f8f9fa';
  const card = dark ? '#18181b' : '#ffffff';
  const border = dark ? '#27272a' : '#e5e7eb';
  const ink = dark ? '#ffffff' : '#0F172A';
  const muted = dark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)';

  const ThemeToggle = (
    <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.cardTitle, { color: ink }]}>Dark mode</Text>
        <Text style={[s.cardSub, { color: muted }]}>Easier on the eyes at night</Text>
      </View>
      <Switch value={dark} onValueChange={toggleTheme} trackColor={{ true: '#0B5FFF', false: '#d1d5db' }} thumbColor="#fff" />
    </View>
  );

  if (!session || !profile) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
        <View style={s.center}>
          <Text style={[s.heading, { color: ink, marginBottom: 8 }]}>You're browsing as a guest</Text>
          <Text style={[s.cardSub, { color: muted, textAlign: 'center', marginBottom: 24 }]}>
            Create an account to place bids, save lots, and track your wins.
          </Text>
          <Pressable onPress={() => router.push('/(auth)/role')} style={[s.btn, { backgroundColor: '#0B5FFF', width: 240 }]}>
            <Text style={[s.btnText, { color: '#fff' }]}>Create an account</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(auth)/login')} style={{ marginTop: 16 }}>
            <Text style={{ color: '#0B5FFF', fontSize: 14, textDecorationLine: 'underline' }}>I already have an account</Text>
          </Pressable>
          <View style={{ width: '100%', marginTop: 32 }}>{ThemeToggle}</View>
        </View>
      </SafeAreaView>
    );
  }

  const roleColor = profile.role === 'auctioneer' ? '#0B5FFF' : '#16A34A';
  const kycColor = profile.kyc_status === 'approved' ? '#16A34A' : profile.kyc_status === 'pending' ? '#D97706' : '#DC2626';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={[s.heading, { color: ink, marginBottom: 20 }]}>Profile</Text>

        {/* Avatar + name card */}
        <View style={[s.card, { backgroundColor: card, borderColor: border, marginBottom: 12 }]}>
          <View style={s.avatarRow}>
            <View style={s.avatar}>
              <Text style={s.avatarLetter}>{profile.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: ink, fontSize: 18 }]}>{profile.full_name}</Text>
              <Text style={[s.cardSub, { color: muted }]}>{profile.email}</Text>
              {profile.phone ? <Text style={[s.cardSub, { color: muted }]}>{profile.phone}</Text> : null}
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.row}>
            <View style={s.pill}>
              <View style={[s.pillDot, { backgroundColor: roleColor }]} />
              <Text style={[s.pillText, { color: roleColor }]}>{profile.role}</Text>
            </View>
            <View style={[s.pill, { marginLeft: 8 }]}>
              <View style={[s.pillDot, { backgroundColor: kycColor }]} />
              <Text style={[s.pillText, { color: kycColor }]}>KYC {profile.kyc_status}</Text>
            </View>
          </View>
        </View>

        {/* Auctioneer actions */}
        {profile.role === 'auctioneer' && (
          <AuctioneerPanel userId={session.user.id} ink={ink} muted={muted} card={card} border={border} />
        )}

        {/* Dark mode */}
        <View style={{ marginBottom: 12 }}>{ThemeToggle}</View>

        {/* Sign out */}
        <Pressable
          onPress={signOut}
          style={[s.btn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#DC2626' }]}
        >
          <Text style={[s.btnText, { color: '#DC2626' }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  heading: { fontSize: 26, fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'column',
  },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 13, marginTop: 2 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#0B5FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 22, fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(150,150,150,0.15)', marginVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  pillText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
});
