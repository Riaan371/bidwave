import { View, Text, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { useAppTheme, Colors } from '../../lib/theme';
import LotCard, { formatZAR } from '../../components/LotCard';
import { ListSkeleton } from '../../components/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES: { name: string; icon: React.ReactNode; color: string }[] = [
  { name: 'Vehicles',          icon: <MaterialIcons name="directions-car" size={26} color="#fff" />,        color: '#1E40AF' },
  { name: 'Plant & Equipment', icon: <MaterialIcons name="construction" size={26} color="#fff" />,          color: '#92400E' },
  { name: 'Livestock',         icon: <MaterialCommunityIcons name="cow" size={26} color="#fff" />,          color: '#065F46' },
  { name: 'Property',          icon: <MaterialIcons name="home-work" size={26} color="#fff" />,             color: '#7C3AED' },
  { name: 'Industrial',        icon: <MaterialIcons name="precision-manufacturing" size={26} color="#fff" />, color: '#374151' },
  { name: 'Household',         icon: <MaterialIcons name="weekend" size={26} color="#fff" />,               color: '#B45309' },
  { name: 'Electronics',       icon: <MaterialIcons name="devices" size={26} color="#fff" />,               color: '#0369A1' },
  { name: 'Collectibles',      icon: <MaterialIcons name="diamond" size={26} color="#fff" />,               color: '#BE185D' },
  { name: 'Art & Jewellery',   icon: <MaterialIcons name="palette" size={26} color="#fff" />,               color: '#9D174D' },
];

// Placeholder auction images per category
const CATEGORY_IMAGES: Record<string, string> = {
  'Vehicles': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600',
  'Plant & Equipment': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600',
  'Livestock': 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=600',
  'Property': 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600',
  'Industrial': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600',
  'Household': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600',
  'Electronics': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600',
  'Collectibles': 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=600',
  'Art & Jewellery': 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600',
};

type LotWithAuction = {
  id: string; title: string; photos: string[];
  starting_bid: number; current_bid: number | null;
  category: string | null; created_at: string;
  auctions: { end_at: string | null } | null;
};

async function fetchLots(): Promise<LotWithAuction[]> {
  const { data, error } = await supabase
    .from('lots').select('id, title, photos, starting_bid, current_bid, category, created_at, auctions(end_at)')
    .neq('closed', true)
    .order('created_at', { ascending: false }).limit(50);
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

async function fetchScheduledSessions(): Promise<{ auction_id: string; title: string | null; scheduled_at: string | null; lot_ids: string[] | null }[]> {
  const { data } = await supabase
    .from('live_sessions')
    .select('auction_id, title, scheduled_at, lot_ids')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(6);
  return (data ?? []) as any;
}

function AuctionEventCard({ session, lots }: { session: any; lots: LotWithAuction[] }) {
  const dt = session.scheduled_at ? new Date(session.scheduled_at) : null;
  const dateStr = dt ? dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const timeStr = dt ? dt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '';

  // Find a representative image from the lots
  const sessionLots = lots.filter(l => session.lot_ids?.includes(l.id));
  const coverImage = sessionLots.find(l => l.photos?.[0])?.photos?.[0]
    ?? CATEGORY_IMAGES[sessionLots[0]?.category ?? '']
    ?? 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600';

  return (
    <View style={s.auctionCard}>
      <Image source={{ uri: coverImage }} style={s.auctionCardImage} resizeMode="cover" />
      <View style={s.auctionCardOverlay} />
      <View style={s.auctionCardContent}>
        {dt && (
          <Text style={s.auctionCardDate}>{dateStr}</Text>
        )}
        <Text style={s.auctionCardTitle} numberOfLines={2}>{session.title ?? 'Live Auction'}</Text>
        {dt && <Text style={s.auctionCardTime}>🕙 Starting at {timeStr}</Text>}
        {sessionLots.length > 0 && (
          <Text style={s.auctionCardLots}>{sessionLots.length} lot{sessionLots.length !== 1 ? 's' : ''} listed</Text>
        )}
        <Pressable style={s.auctionCardBtn} onPress={() => router.push(`/live/${session.auction_id}`)}>
          <Text style={s.auctionCardBtnTxt}>More Info</Text>
        </Pressable>
      </View>
    </View>
  );
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

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <FlatList
        data={lots ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={s.hero}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Image source={require('../../assets/logo.png')} style={s.heroLogo} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={s.heroTitle}>West Coast Pickers</Text>
                  <Text style={s.heroSub}>South Africa's Live Auction Marketplace 🇿🇦</Text>
                </View>
                <Pressable onPress={refetch} style={s.refreshBtn}>
                  <Text style={{ fontSize: 16 }}>{isRefetching ? '⏳' : '🔄'}</Text>
                </Pressable>
              </View>
              {profile && (
                <Text style={s.welcomeTxt}>Welcome back, {profile.full_name.split(' ')[0]} 👋</Text>
              )}
            </View>

            {/* LIVE NOW banner */}
            {liveSessions && liveSessions.length > 0 && (
              <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                {liveSessions.map((ls) => (
                  <Pressable key={ls.auction_id} onPress={() => router.push(`/live/${ls.auction_id}`)} style={s.liveBanner}>
                    <View style={s.livePulse} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.liveTxt}>🔴 LIVE NOW</Text>
                      <Text style={s.liveSubTxt}>{ls.auctions?.title ?? 'Live Auction'} — Tap to join</Text>
                    </View>
                    <Text style={{ fontSize: 22 }}>🔊</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Upcoming Auction Event Cards - bidway style */}
            {scheduledSessions && scheduledSessions.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: ink }]}>Upcoming Auctions</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                  {scheduledSessions.map((ls) => (
                    <AuctionEventCard key={ls.auction_id} session={ls} lots={lots ?? []} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Categories - bidway style */}
            <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
              <Text style={[s.sectionTitle, { color: ink }]}>Browse by Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.name}
                    onPress={() => router.push({ pathname: '/(tabs)/search', params: { category: cat.name } })}
                    style={[s.catChip, { backgroundColor: cat.color }]}
                  >
                    {cat.icon}
                    <Text style={s.catChipName}>{cat.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* All Lots heading */}
            <View style={[s.sectionHeader, { paddingHorizontal: 16 }]}>
              <Text style={[s.sectionTitle, { color: ink }]}>All Lots</Text>
            </View>
            {isLoading && <ListSkeleton />}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🔨</Text>
              <Text style={{ fontSize: 16, color: ink, fontWeight: '700', marginBottom: 6 }}>No lots yet</Text>
              <Text style={{ fontSize: 14, color: muted, textAlign: 'center' }}>
                Check back soon — new items are added regularly.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <LotCard lot={{ ...item, end_at: item.auctions?.end_at }} index={index} isWatched={watchedIds?.has(item.id)} />
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // Hero
  hero: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20, marginBottom: 16 },
  heroLogo: { width: 44, height: 44, borderRadius: 10 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  welcomeTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 10, fontStyle: 'italic' },
  refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Live banner
  liveBanner: { backgroundColor: '#DC2626', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  livePulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  liveSubTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  // Section headers
  sectionHeader: { paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },

  // Auction event card (bidway style)
  auctionCard: { width: SCREEN_WIDTH * 0.72, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0D1B2A', marginBottom: 4 },
  auctionCardImage: { width: '100%', height: 160 },
  auctionCardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', top: 0, height: 160 },
  auctionCardContent: { padding: 14 },
  auctionCardDate: { color: '#F97316', fontWeight: '700', fontSize: 12, letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
  auctionCardTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 6, lineHeight: 22 },
  auctionCardTime: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  auctionCardLots: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 12 },
  auctionCardBtn: { backgroundColor: '#F97316', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  auctionCardBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Category chips (horizontal scroll)
  catChip: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', minWidth: 90 },
  catChipName: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 2, textAlign: 'center' },
});
