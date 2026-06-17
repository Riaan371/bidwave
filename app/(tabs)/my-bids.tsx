import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { useAppTheme, Colors } from '../../lib/theme';

const TABS = ['Active', 'Winning', 'Outbid', 'Won'] as const;

function formatZAR(n: number) { return `R${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`; }

export default function MyBids() {
  const [tab, setTab] = useState<typeof TABS[number]>('Active');
  const session = useAuthStore((s) => s.session);
  const { bg, card, border, ink, muted } = useAppTheme();

  const { data: bids } = useQuery({
    queryKey: ['bids', 'mine', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids').select('*, lots(id, title, current_bid, photos)').eq('bidder_id', session!.user.id).order('placed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!session) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
        <View style={s.header}><Text style={[s.title, { color: ink }]}>My Bids</Text></View>
        <View style={s.empty}>
          <Text style={[s.emptyTxt, { color: muted }]}>Log in to view your bids.</Text>
          <Pressable onPress={() => router.push('/(auth)/login')} style={[s.btn, { marginTop: 16 }]}>
            <Text style={s.btnTxt}>Log in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: ink }]}>My Bids</Text>
        <View style={s.tabs}>
          {TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[s.tabBtn, tab === t && { borderBottomColor: Colors.primary, borderBottomWidth: 2 }]}>
              <Text style={[s.tabTxt, { color: tab === t ? Colors.primary : muted }]}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={bids ?? []}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={s.empty}><Text style={[s.emptyTxt, { color: muted }]}>No bids yet in this tab.</Text></View>
        }
        renderItem={({ item }: any) => (
          <Pressable onPress={() => router.push(`/lot/${item.lots?.id}`)} style={[s.card, { backgroundColor: card, borderColor: border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.lotTitle, { color: ink }]} numberOfLines={1}>{item.lots?.title ?? '—'}</Text>
              <Text style={[s.bidAmt, { color: Colors.primary }]}>{formatZAR(item.amount)}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: item.amount >= (item.lots?.current_bid ?? 0) ? '#dcfce7' : '#fef2f2' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: item.amount >= (item.lots?.current_bid ?? 0) ? Colors.success : Colors.danger }}>
                {item.amount >= (item.lots?.current_bid ?? 0) ? 'Winning' : 'Outbid'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 0 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 14 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.15)' },
  tabBtn: { marginRight: 24, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabTxt: { fontSize: 14, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  lotTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  bidAmt: { fontSize: 18, fontWeight: '800' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 60 },
  emptyTxt: { fontSize: 15, textAlign: 'center' },
  btn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
