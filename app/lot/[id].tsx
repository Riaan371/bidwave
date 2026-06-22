import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

  const [customBid, setCustomBid] = useState<number | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const screenWidth = Dimensions.get('window').width;

  const { data: lot, isLoading } = useQuery({
    queryKey: ['lot', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('lots').select('*, auctions(end_at)').eq('id', id).single();
      if (error) throw error;
      return data as Lot & { auctions: { end_at: string | null } | null };
    },
  });

  const { data: liveSession } = useQuery({
    queryKey: ['live-session', lot?.auction_id],
    queryFn: async () => {
      if (!lot?.auction_id) return null;
      const { data } = await supabase
        .from('live_sessions')
        .select('auction_id, lot_ids, current_lot_index')
        .eq('auction_id', lot.auction_id)
        .eq('status', 'live')
        .maybeSingle();
      return data;
    },
    enabled: !!lot?.auction_id,
  });

  // Auto-redirect all users when auctioneer advances to next lot
  useEffect(() => {
    if (!liveSession?.lot_ids || !id) return;
    const activeLotId = liveSession.lot_ids[liveSession.current_lot_index ?? 0];
    if (activeLotId && activeLotId !== id) {
      router.replace(`/lot/${activeLotId}`);
    }
  }, [liveSession?.current_lot_index, id]);

  const { data: bids } = useQuery({
    queryKey: ['lot', id, 'bids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('id, amount, placed_at, bidder_id, users(full_name)')
        .eq('lot_id', id)
        .order('amount', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as { id: string; amount: number; placed_at: string; bidder_id: string; users: { full_name: string } | null }[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`lot-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots', filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['lot', id] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `lot_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['lot', id, 'bids'] });
        queryClient.invalidateQueries({ queryKey: ['lot', id] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_sessions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-session'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Sync customBid up when current_bid changes (someone outbids)
  useEffect(() => {
    if (lot) {
      const min = (lot.current_bid ?? lot.starting_bid) + lot.increment;
      setCustomBid((prev) => (prev === null || prev < min) ? min : prev);
    }
  }, [lot?.current_bid, lot?.starting_bid]);

  const endLiveSession = async () => {
    await supabase.from('live_sessions')
      .update({ status: 'ended' })
      .eq('auction_id', lot?.auction_id ?? '')
      .eq('status', 'live');
    queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['live-session', lot?.auction_id] });
  };

  const markSold = useMutation({
    mutationFn: async () => {
      if (!bids || bids.length === 0) throw new Error('No bids placed yet.');
      const topBid = bids[0];
      const { error } = await supabase.from('lots').update({
        winner_id: topBid.bidder_id,
        current_bid: topBid.amount,
        closed: true,
        no_sale: false,
      }).eq('id', id);
      if (error) throw error;
      // Save sale record
      await supabase.from('sales').insert({
        lot_id: id,
        winner_id: topBid.bidder_id,
        sale_price: topBid.amount,
        winner_name: topBid.users?.full_name ?? null,
        sold_at: new Date().toISOString(),
      }).select();
      await endLiveSession();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot', id] });
    },
    onError: async (e: any) => {
      // sales table may not exist yet — still mark lot as sold
      if (e.message?.includes('sales')) {
        queryClient.invalidateQueries({ queryKey: ['lot', id] });
      } else {
        Alert.alert('Error', e.message);
      }
    },
  });

  const markNoSale = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('lots').update({ closed: true, no_sale: true }).eq('id', id);
      if (error) throw error;
      await endLiveSession();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot', id] });
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const placeBid = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Please log in to bid.');
      if (!lot) throw new Error('Lot not loaded.');
      const minBid = (lot.current_bid ?? lot.starting_bid) + lot.increment;
      const bidAmount = customBid ?? minBid;
      if (bidAmount < minBid) throw new Error(`Minimum bid is ${formatZAR(minBid)}`);
      const { error } = await supabase.from('bids').insert({ lot_id: lot.id, bidder_id: session.user.id, amount: bidAmount });
      if (error) throw error;
      return bidAmount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot', id] });
      queryClient.invalidateQueries({ queryKey: ['lot', id, 'bids'] });
    },
    onError: (error: any) => { Alert.alert('Could not place bid', error.message); },
  });

  if (isLoading || !lot) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const minNextBid = (lot.current_bid ?? lot.starting_bid) + lot.increment;
  const bidAmount = customBid ?? minNextBid;
  const topBidderId = bids?.[0]?.bidder_id ?? null;
  const isTopBidder = !!session && topBidderId === session.user.id;
  const isAuctioneer = useAuthStore.getState().profile?.role === 'auctioneer';
  const isSold = !!lot.winner_id;
  const isNoSale = (lot as any).no_sale === true;
  const isClosed = (lot as any).closed === true;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <Stack.Screen options={{ headerShown: true, headerTitle: '', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Image carousel */}
        {lot.photos && lot.photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                setPhotoIndex(idx);
              }}
              scrollEventThrottle={16}
            >
              {lot.photos.map((uri: string, i: number) => (
                <Image key={i} source={{ uri }} style={[s.heroImg, { width: screenWidth }]} resizeMode="cover" />
              ))}
            </ScrollView>
            {lot.photos.length > 1 && (
              <View style={s.dotRow}>
                {lot.photos.map((_: string, i: number) => (
                  <View key={i} style={[s.dot, i === photoIndex && s.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[s.heroImg, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#9ca3af', fontSize: 40 }}>📷</Text>
          </View>
        )}

        {liveSession && (
          <Pressable onPress={() => router.push(`/live/${liveSession.auction_id}`)} style={s.liveBanner}>
            <View style={s.liveDot} />
            <View style={{ flex: 1 }}>
              <Text style={s.liveTxt}>LIVE NOW — Auctioneer is broadcasting</Text>
              <Text style={s.liveSubTxt}>Tap to join live audio</Text>
            </View>
            <Text style={{ fontSize: 20 }}>🔊</Text>
          </Pressable>
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text style={[s.title, { color: ink }]}>{lot.title}</Text>
          {lot.description && <Text style={[s.desc, { color: muted }]}>{lot.description}</Text>}
          {lot.auctions?.end_at && <CountdownTimer endAt={lot.auctions.end_at} style={{ fontSize: 14, marginTop: 8 }} />}

          <View style={[s.bidRow, { borderTopColor: border }]}>
            <View>
              <Text style={[s.bidLabel, { color: muted }]}>Current bid</Text>
              <Text style={s.bidAmt}>{formatZAR(lot.current_bid ?? lot.starting_bid)}</Text>
            </View>
            {lot.buy_now && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.bidLabel, { color: muted }]}>Buy Now</Text>
                <Text style={[s.bidAmt, { color: Colors.accent }]}>{formatZAR(lot.buy_now)}</Text>
              </View>
            )}
          </View>

          {/* Top bidder status */}
          {isTopBidder && (
            <View style={s.topBidderBadge}>
              <Text style={s.topBidderTxt}>🏆 You are the highest bidder</Text>
            </View>
          )}

          {/* Bid history with names */}
          <Text style={[s.historyLabel, { color: muted }]}>Bid history</Text>
          {bids && bids.length > 0 ? (
            bids.map((b, i) => {
              const name = b.users?.full_name ?? 'Anonymous';
              const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
              const isMe = session && b.bidder_id === session.user.id;
              return (
                <View key={b.id} style={[s.bidHistoryRow, { borderBottomColor: border }]}>
                  <View style={[s.avatar, { backgroundColor: i === 0 ? Colors.primary : 'rgba(150,150,150,0.2)' }]}>
                    <Text style={[s.avatarTxt, { color: i === 0 ? '#fff' : ink }]}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[{ color: ink, fontWeight: i === 0 ? '700' : '400', fontSize: 14 }]}>
                      {isMe ? 'You' : name} {i === 0 ? '👑' : ''}
                    </Text>
                    <Text style={[s.bidHistoryTime, { color: muted }]}>{new Date(b.placed_at).toLocaleString('en-ZA')}</Text>
                  </View>
                  <Text style={[s.bidHistoryAmt, { color: i === 0 ? Colors.primary : ink, fontWeight: i === 0 ? '800' : '600' }]}>
                    {formatZAR(b.amount)}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={{ color: muted, fontSize: 13 }}>No bids yet — be the first.</Text>
          )}
        </View>
      </ScrollView>

      {/* Auctioneer footer */}
      {isAuctioneer && (
        <View style={[s.footer, { backgroundColor: card, borderTopColor: border }]}>
          {isClosed ? (
            <View style={{ gap: 10 }}>
              <View style={[s.soldBadge, isNoSale && { borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.1)' }]}>
                <Text style={[s.soldTxt, isNoSale && { color: '#D97706' }]}>
                  {isNoSale ? '🚫 No Sale — Bidding Closed' : `🔨 SOLD — ${formatZAR(lot.current_bid)}`}
                </Text>
                {!isNoSale && (
                  <Text style={{ color: '#16A34A', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    Winner: {bids?.[0]?.users?.full_name ?? 'Top bidder'}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={async () => {
                  const ls = liveSession;
                  if (ls?.lot_ids) {
                    const next = (ls.current_lot_index ?? 0) + 1;
                    if (next < ls.lot_ids.length) {
                      // Advance index — all users auto-redirect via the useEffect above
                      await supabase.from('live_sessions')
                        .update({ current_lot_index: next })
                        .eq('auction_id', lot.auction_id)
                        .eq('status', 'live');
                      router.replace(`/lot/${ls.lot_ids[next]}`);
                    } else {
                      router.push(`/live/${lot.auction_id}`);
                    }
                  } else {
                    router.push(`/live/${lot.auction_id}`);
                  }
                }}
                style={{ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>▶ Next Lot — Back to Live Room</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => {
                  if (!bids?.length) { Alert.alert('No bids yet', 'There are no bids on this lot.'); return; }
                  markSold.mutate();
                }}
                disabled={markSold.isPending || markNoSale.isPending}
                style={[s.soldBtn, { opacity: markSold.isPending ? 0.7 : 1 }]}
              >
                {markSold.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.soldBtnTxt}>🔨 SOLD — Close Bidding</Text>}
              </Pressable>
              <Pressable
                onPress={() => markNoSale.mutate()}
                disabled={markSold.isPending || markNoSale.isPending}
                style={[s.noSaleBtn, { opacity: markNoSale.isPending ? 0.7 : 1 }]}
              >
                {markNoSale.isPending ? <ActivityIndicator color="#D97706" /> : <Text style={s.noSaleBtnTxt}>🚫 No Sale — Close Bidding</Text>}
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Bidding footer */}
      {!isAuctioneer && isClosed && (
        <View style={[s.footer, { backgroundColor: card, borderTopColor: border }]}>
          <View style={[s.soldBadge, isNoSale && { borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.1)' }]}>
            <Text style={[s.soldTxt, isNoSale && { color: '#D97706' }]}>
              {isNoSale ? '🚫 Bidding Closed — No Sale' : `🔨 SOLD — ${formatZAR(lot.current_bid)}`}
            </Text>
          </View>
        </View>
      )}
      {!isAuctioneer && !isClosed && (
        <View style={[s.footer, { backgroundColor: card, borderTopColor: border }]}>
          {isTopBidder ? (
            <View style={s.topBidderFooter}>
              <Text style={s.topBidderFooterTxt}>🏆 You're the highest bidder at {formatZAR(lot.current_bid)}</Text>
              <Text style={{ color: muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>Place a higher bid to stay on top if outbid</Text>
            </View>
          ) : (
            <>
              {/* Bid amount controls */}
              <View style={s.bidControls}>
                <Pressable
                  onPress={() => setCustomBid((prev) => Math.max(minNextBid, (prev ?? minNextBid) - lot.increment))}
                  style={[s.adjustBtn, { borderColor: border }]}
                >
                  <Text style={[s.adjustBtnTxt, { color: ink }]}>−</Text>
                </Pressable>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: muted, fontSize: 11, marginBottom: 2 }}>Your bid</Text>
                  <Text style={{ color: ink, fontWeight: '800', fontSize: 20 }}>{formatZAR(bidAmount)}</Text>
                </View>
                <Pressable
                  onPress={() => setCustomBid((prev) => (prev ?? minNextBid) + lot.increment)}
                  style={[s.adjustBtn, { borderColor: border }]}
                >
                  <Text style={[s.adjustBtnTxt, { color: ink }]}>+</Text>
                </Pressable>
              </View>
              <Pressable
                disabled={placeBid.isPending}
                onPress={() => { if (!session) { router.push('/(auth)/role'); return; } placeBid.mutate(); }}
                style={[s.bidBtn, { opacity: placeBid.isPending ? 0.8 : 1 }]}
              >
                {placeBid.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.bidBtnTxt}>{session ? `Place Bid — ${formatZAR(bidAmount)}` : 'Log in to place a bid'}</Text>}
              </Pressable>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  heroImg: { width: '100%', height: 280 },
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#d1d5db' },
  dotActive: { backgroundColor: Colors.primary, width: 18 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  desc: { fontSize: 15, lineHeight: 22 },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, borderTopWidth: 1, paddingTop: 16 },
  bidLabel: { fontSize: 12, marginBottom: 2 },
  bidAmt: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  topBidderBadge: { backgroundColor: 'rgba(22,163,74,0.1)', borderWidth: 1, borderColor: '#16A34A', borderRadius: 10, padding: 10, marginTop: 12, alignItems: 'center' },
  topBidderTxt: { color: '#16A34A', fontWeight: '700', fontSize: 14 },
  historyLabel: { fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  bidHistoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700' },
  bidHistoryTime: { fontSize: 11, marginTop: 2 },
  bidHistoryAmt: { fontSize: 15 },
  liveBanner: { backgroundColor: '#DC2626', marginHorizontal: 16, marginTop: 12, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  liveSubTxt: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 14 },
  bidControls: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  adjustBtn: { width: 44, height: 44, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  adjustBtnTxt: { fontSize: 22, fontWeight: '700' },
  bidBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  bidBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  topBidderFooter: { alignItems: 'center', paddingVertical: 8 },
  topBidderFooterTxt: { color: '#16A34A', fontWeight: '800', fontSize: 15 },
  soldBtn: { backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  soldBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  noSaleBtn: { borderWidth: 1.5, borderColor: '#D97706', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  noSaleBtnTxt: { color: '#D97706', fontWeight: '700', fontSize: 15 },
  soldBadge: { backgroundColor: 'rgba(22,163,74,0.1)', borderWidth: 1.5, borderColor: '#16A34A', borderRadius: 14, padding: 14, alignItems: 'center' },
  soldTxt: { color: '#16A34A', fontWeight: '800', fontSize: 17 },
});
