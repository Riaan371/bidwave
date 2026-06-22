import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAppTheme, Colors } from '../../lib/theme';

function formatZAR(n: number | null | undefined) {
  if (n == null) return '—';
  return `R${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

function timeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export default function AuctionDetail() {
  const { auctionId } = useLocalSearchParams<{ auctionId: string }>();
  const { bg, card, border, ink, muted } = useAppTheme();

  const { data: auction, isLoading: loadingAuction } = useQuery({
    queryKey: ['auction', auctionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('auctions')
        .select('id, title, type, status, end_at')
        .eq('id', auctionId)
        .single();
      return data;
    },
  });

  const { data: lots, isLoading: loadingLots } = useQuery({
    queryKey: ['auction-lots', auctionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lots')
        .select('id, title, photos, starting_bid, current_bid, category, closed')
        .eq('auction_id', auctionId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!auctionId,
  });

  const isTimed = auction?.type === 'timed';
  const isClosed = auction?.status === 'closed' || auction?.status === 'cancelled';
  const isLoading = loadingAuction || loadingLots;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <Stack.Screen options={{
        headerShown: true,
        title: auction?.title ?? 'Auction',
        headerStyle: { backgroundColor: Colors.navy },
        headerTintColor: '#fff',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 8 }}>
            <Text style={{ color: '#fff', fontSize: 15 }}>← Back</Text>
          </Pressable>
        ),
      }} />

      {isLoading ? (
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {/* Auction header */}
          <View style={[s.headerCard, { backgroundColor: Colors.navy }]}>
            <View style={s.typeBadge}>
              <Text style={s.typeBadgeTxt}>{isTimed ? '⏱ TIMED AUCTION' : '🔴 LIVE AUCTION'}</Text>
            </View>
            <Text style={s.auctionTitle}>{auction?.title}</Text>
            {auction?.end_at && (
              <Text style={s.countdown}>
                {isTimed
                  ? timeUntil(auction.end_at)
                  : `Starts: ${new Date(auction.end_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              </Text>
            )}
            {!isTimed && (
              <View style={s.liveNotice}>
                <Text style={s.liveNoticeTxt}>
                  Bidding opens when the auctioneer goes live. Browse the lots below.
                </Text>
              </View>
            )}
          </View>

          {/* Closed auction banner */}
          {isClosed && (
            <View style={s.closedBanner}>
              <Text style={s.closedBannerTxt}>🔒 This auction has ended. Items are archived.</Text>
            </View>
          )}

          {/* Lot count */}
          <Text style={[s.lotCount, { color: muted }]}>
            {lots?.length ?? 0} lot{lots?.length !== 1 ? 's' : ''} in this auction
          </Text>

          {/* Lot list */}
          {(lots ?? []).map((lot: any) => {
            const currentBid = lot.current_bid ?? lot.starting_bid;
            const photo = lot.photos?.[0];
            const closed = lot.closed;

            return (
              <Pressable
                key={lot.id}
                style={[s.lotCard, { backgroundColor: card, borderColor: border }]}
                onPress={() => isTimed && !closed && !isClosed ? router.push(`/lot/${lot.id}`) : undefined}
              >
                <Image
                  source={{ uri: photo || 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400' }}
                  style={s.lotImg}
                  resizeMode="cover"
                />
                <View style={s.lotInfo}>
                  <Text style={[s.lotCategory, { color: muted }]}>{lot.category?.toUpperCase()}</Text>
                  <Text style={[s.lotTitle, { color: ink }]} numberOfLines={2}>{lot.title}</Text>
                  <Text style={[s.lotBid, { color: Colors.gold }]}>
                    {lot.current_bid ? `Current: ${formatZAR(lot.current_bid)}` : `Starting: ${formatZAR(lot.starting_bid)}`}
                  </Text>
                  {closed ? (
                    <View style={s.closedBadge}>
                      <Text style={s.closedTxt}>SOLD / CLOSED</Text>
                    </View>
                  ) : isTimed ? (
                    <View style={s.bidBtn}>
                      <Text style={s.bidBtnTxt}>Place Bid →</Text>
                    </View>
                  ) : (
                    <View style={[s.bidBtn, { backgroundColor: Colors.navy, borderWidth: 1, borderColor: Colors.gold }]}>
                      <Text style={[s.bidBtnTxt, { color: Colors.gold }]}>View Only — Bidding Opens Live</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}

          {lots?.length === 0 && (
            <Text style={[s.emptyTxt, { color: muted }]}>No lots added to this auction yet.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  headerCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  typeBadge: { backgroundColor: Colors.gold, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10 },
  typeBadgeTxt: { color: Colors.navy, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  auctionTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  countdown: { color: Colors.gold, fontWeight: '700', fontSize: 14, marginBottom: 8 },
  liveNotice: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, marginTop: 4 },
  liveNoticeTxt: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  lotCount: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  lotCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  lotImg: { width: 110, height: 110 },
  lotInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  lotCategory: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  lotTitle: { fontSize: 14, fontWeight: '700', lineHeight: 19, marginBottom: 4 },
  lotBid: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  bidBtn: { backgroundColor: Colors.gold, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  bidBtnTxt: { color: Colors.navy, fontWeight: '800', fontSize: 12 },
  closedBadge: { backgroundColor: '#6B7280', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  closedTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  closedBanner: { backgroundColor: '#374151', borderRadius: 12, padding: 14, marginBottom: 12, alignItems: 'center' },
  closedBannerTxt: { color: '#D1D5DB', fontWeight: '600', fontSize: 13 },
  emptyTxt: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});
