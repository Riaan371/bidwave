import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { useAppTheme, Colors } from '../../lib/theme';
import type { Lot } from '../../lib/types';
import CountdownTimer from '../../components/CountdownTimer';

function formatZAR(amount: number | null | undefined) {
  if (amount == null) return '—';
  return `R${amount.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

export default function LotDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const { bg, card, border, ink, muted } = useAppTheme();
  const bidScale = useSharedValue(1);

  const { data: lot, isLoading } = useQuery({
    queryKey: ['lot', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('lots').select('*, auctions(end_at)').eq('id', id).single();
      if (error) throw error;
      return data as Lot & { auctions: { end_at: string | null } | null };
    },
  });

  const { data: bids } = useQuery({
    queryKey: ['lot', id, 'bids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids').select('id, amount, placed_at').eq('lot_id', id)
        .order('amount', { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`lot-${id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots', filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['lot', id] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `lot_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['lot', id, 'bids'] });
        bidScale.value = withSequence(withTiming(1.08, { duration: 120 }), withTiming(1, { duration: 180 }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const placeBid = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Please log in to bid.');
      if (!lot) throw new Error('Lot not loaded.');
      const nextBid = (lot.current_bid ?? lot.starting_bid) + lot.increment;
      const { error } = await supabase.from('bids').insert({ lot_id: lot.id, bidder_id: session.user.id, amount: nextBid });
      if (error) throw error;
      return nextBid;
    },
    onSuccess: () => {
      bidScale.value = withSequence(withTiming(1.08, { duration: 120 }), withTiming(1, { duration: 180 }));
      queryClient.invalidateQueries({ queryKey: ['lot', id] });
      queryClient.invalidateQueries({ queryKey: ['lot', id, 'bids'] });
    },
    onError: (error: any) => { Alert.alert('Could not place bid', error.message); },
  });

  const bidPriceStyle = useAnimatedStyle(() => ({ transform: [{ scale: bidScale.value }] }));

  if (isLoading || !lot) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const nextBid = (lot.current_bid ?? lot.starting_bid) + lot.increment;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <Stack.Screen options={{ headerShown: true, headerTitle: '', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Image source={{ uri: lot.photos?.[0] }} style={s.heroImg} resizeMode="cover" />
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text style={[s.title, { color: ink }]}>{lot.title}</Text>
          {lot.description && <Text style={[s.desc, { color: muted }]}>{lot.description}</Text>}
          {lot.auctions?.end_at && <CountdownTimer endAt={lot.auctions.end_at} style={{ fontSize: 14, marginTop: 8 }} />}

          <View style={[s.bidRow, { borderTopColor: border }]}>
            <View>
              <Text style={[s.bidLabel, { color: muted }]}>Current bid</Text>
              <Animated.Text style={[s.bidAmt, bidPriceStyle]}>{formatZAR(lot.current_bid ?? lot.starting_bid)}</Animated.Text>
            </View>
            {lot.buy_now && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.bidLabel, { color: muted }]}>Buy Now</Text>
                <Text style={[s.bidAmt, { color: Colors.accent }]}>{formatZAR(lot.buy_now)}</Text>
              </View>
            )}
          </View>

          <Text style={[s.historyLabel, { color: muted }]}>Bid history</Text>
          {bids && bids.length > 0 ? (
            bids.map((b: any) => (
              <View key={b.id} style={[s.bidHistoryRow, { borderBottomColor: border }]}>
                <Text style={[s.bidHistoryTime, { color: muted }]}>{new Date(b.placed_at).toLocaleString('en-ZA')}</Text>
                <Text style={[s.bidHistoryAmt, { color: ink }]}>{formatZAR(b.amount)}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: muted, fontSize: 13 }}>No bids yet — be the first.</Text>
          )}
        </View>
      </ScrollView>

      <View style={[s.footer, { backgroundColor: card, borderTopColor: border }]}>
        <Pressable
          disabled={placeBid.isPending}
          onPress={() => { if (!session) { router.push('/(auth)/role'); return; } placeBid.mutate(); }}
          style={[s.bidBtn, { opacity: placeBid.isPending ? 0.8 : 1 }]}
        >
          {placeBid.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.bidBtnTxt}>{session ? `Place Bid — ${formatZAR(nextBid)}` : 'Log in to place a bid'}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  heroImg: { width: '100%', height: 280 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  desc: { fontSize: 15, lineHeight: 22 },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, borderTopWidth: 1, paddingTop: 16 },
  bidLabel: { fontSize: 12, marginBottom: 2 },
  bidAmt: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  historyLabel: { fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  bidHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  bidHistoryTime: { fontSize: 13 },
  bidHistoryAmt: { fontSize: 13, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 14 },
  bidBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  bidBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
