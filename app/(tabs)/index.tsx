import { View, Text, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { useAppTheme, Colors } from '../../lib/theme';
import LotCard, { formatZAR } from '../../components/LotCard';
import CountdownTimer from '../../components/CountdownTimer';
import { ListSkeleton } from '../../components/Skeleton';

const CATEGORIES = [
  { name: 'Vehicles', emoji: '🚗' },
  { name: 'Livestock', emoji: '🐄' },
  { name: 'Property', emoji: '🏠' },
  { name: 'Electronics', emoji: '📷' },
  { name: 'Collectibles', emoji: '💎' },
  { name: 'Art', emoji: '🎨' },
];

type LotWithAuction = {
  id: string; title: string; photos: string[];
  starting_bid: number; current_bid: number | null;
  category: string | null; created_at: string;
  auctions: { end_at: string | null } | null;
};

async function fetchLots(): Promise<LotWithAuction[]> {
  const { data, error } = await supabase
    .from('lots').select('id, title, photos, starting_bid, current_bid, category, created_at, auctions(end_at)')
    .order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data as unknown as LotWithAuction[];
}

async function fetchWatchlistIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase.from('watchlist').select('lot_id').eq('user_id', userId);
  if (error) return new Set();
  return new Set((data ?? []).map((w) => w.lot_id));
}

async function fetchLiveSessions(): Promise<{ auction_id: string; auctions: { title: string } | null }[]> {
  const { data } = await supabase.from('live_sessions').select('auction_id, auctions(title)').eq('status', 'live');
  return (data ?? []) as any;
}

async function fetchScheduledSessions(): Promise<{ auction_id: string; title: string | null; scheduled_at: string | null }[]> {
  const { data } = await supabase
    .from('live_sessions')
    .select('auction_id, title, scheduled_at')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(3);
  return (data ?? []) as any;
}

export default function Home() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const { bg, card, border, ink, muted } = useAppTheme();

  const { data: lots, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['lots', 'home'], queryFn: fetchLots, refetchInterval: 15000,
  });
  const { data: liveSessions } = useQuery({
    queryKey: ['live-sessions'], queryFn: fetchLiveSessions, refetchInterval: 10000,
  });
  const { data: scheduledSessions } = useQuery({
    queryKey: ['scheduled-sessions'], queryFn: fetchScheduledSessions, refetchInterval: 30000,
  });
  const { data: watchedIds } = useQuery({
    queryKey: ['watchlist', session?.user.id],
    queryFn: () => fetchWatchlistIds(session?.user.id),
    enabled: !!session,
  });

  const featured = (lots ?? []).slice(0, 5);
  const endingSoon = [...(lots ?? [])]
    .filter((l) => l.auctions?.end_at)
    .sort((a, b) => new Date(a.auctions!.end_at!).getTime() - new Date(b.auctions!.end_at!).getTime())
    .slice(0, 5);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <FlatList
        data={lots ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={s.hero}>
              <Text style={s.heroSub}>
                {profile ? `Welcome back, ${profile.full_name.split(' ')[0]}` : 'Welcome to'}
              </Text>
              <Text style={s.heroTitle}>BidWave</Text>
              <Text style={s.heroCaption}>South Africa's trusted live & timed auction marketplace 🇿🇦</Text>
            </View>

            {/* Live Now banner */}
            {liveSessions && liveSessions.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
                {liveSessions.map((ls) => (
                  <Pressable key={ls.auction_id} onPress={() => router.push(`/live/${ls.auction_id}`)} style={s.liveBanner}>
                    <View style={s.liveDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.liveTxt}>LIVE NOW</Text>
                      <Text style={s.liveSubTxt}>{ls.auctions?.title ?? 'Live Auction'} — Tap to join audio</Text>
                    </View>
                    <Text style={{ fontSize: 20 }}>🔊</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Upcoming live auctions */}
            {scheduledSessions && scheduledSessions.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
                {scheduledSessions.map((ls, i) => {
                  const dt = ls.scheduled_at ? new Date(ls.scheduled_at) : null;
                  const dateStr = dt ? dt.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }) + ' at ' + dt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <View key={i} style={s.upcomingBanner}>
                      <Text style={{ fontSize: 20, marginRight: 10 }}>📅</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.upcomingTitle}>Upcoming Live Auction</Text>
                        <Text style={s.upcomingName}>{ls.title ?? 'Live Auction'}</Text>
                        {dateStr ? <Text style={s.upcomingDate}>{dateStr}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Categories */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: ink }]}>Browse Categories</Text>
              <View style={s.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.name}
                    onPress={() => router.push({ pathname: '/(tabs)/search', params: { category: cat.name } })}
                    style={[s.catBtn, { backgroundColor: card, borderColor: border }]}
                  >
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>{cat.emoji}</Text>
                    <Text style={[s.catName, { color: ink }]}>{cat.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Featured carousel */}
            {featured.length > 0 && (
              <View style={{ marginBottom: 18 }}>
                <Text style={[s.sectionTitle, { color: ink, marginHorizontal: 16 }]}>⭐ Featured Lots</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {featured.map((lot) => (
                    <Pressable key={lot.id} onPress={() => router.push(`/lot/${lot.id}`)}
                      style={[s.carouselCard, { backgroundColor: card, borderColor: border }]}>
                      <Image source={{ uri: lot.photos?.[0] }} style={s.carouselImg} resizeMode="cover" />
                      <View style={{ padding: 10 }}>
                        <Text style={[s.carouselTitle, { color: ink }]} numberOfLines={1}>{lot.title}</Text>
                        <Text style={s.carouselBid}>{formatZAR(lot.current_bid ?? lot.starting_bid)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Ending soon carousel */}
            {endingSoon.length > 0 && (
              <View style={{ marginBottom: 18 }}>
                <Text style={[s.sectionTitle, { color: ink, marginHorizontal: 16 }]}>🔥 Ending Soon</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {endingSoon.map((lot) => (
                    <Pressable key={lot.id} onPress={() => router.push(`/lot/${lot.id}`)}
                      style={[s.carouselCard, { backgroundColor: card, borderColor: border }]}>
                      <Image source={{ uri: lot.photos?.[0] }} style={s.carouselImg} resizeMode="cover" />
                      <View style={{ padding: 10 }}>
                        <Text style={[s.carouselTitle, { color: ink }]} numberOfLines={1}>{lot.title}</Text>
                        <Text style={s.carouselBid}>{formatZAR(lot.current_bid ?? lot.starting_bid)}</Text>
                        <CountdownTimer endAt={lot.auctions?.end_at} />
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={[s.sectionTitle, { color: ink, marginHorizontal: 16, marginBottom: 8 }]}>All Lots</Text>
            {isLoading && <ListSkeleton />}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 15, color: muted, textAlign: 'center' }}>
                No live lots yet.{'\n'}Check back soon, or browse by category.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <LotCard lot={{ ...item, end_at: item.auctions?.end_at }} index={index} isWatched={watchedIds?.has(item.id)} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 16 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 2 },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '800', marginBottom: 4 },
  heroCaption: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  upcomingBanner: { backgroundColor: 'rgba(11,95,255,0.12)', borderWidth: 1, borderColor: 'rgba(11,95,255,0.25)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  upcomingTitle: { color: Colors.primary, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  upcomingName: { color: '#0F172A', fontWeight: '700', fontSize: 14, marginTop: 2 },
  upcomingDate: { color: 'rgba(15,23,42,0.6)', fontSize: 12, marginTop: 2 },
  liveBanner: { backgroundColor: '#DC2626', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', marginRight: 12 },
  liveTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  liveSubTxt: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  section: { paddingHorizontal: 16, marginBottom: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { width: '30%', borderWidth: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  catName: { fontSize: 12, fontWeight: '600' },
  carouselCard: { width: 176, marginRight: 12, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  carouselImg: { width: 176, height: 112 },
  carouselTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  carouselBid: { fontSize: 15, fontWeight: '800', color: Colors.primary },
});
