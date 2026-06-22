import { View, Text, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { useAppTheme, Colors } from '../../lib/theme';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW > 600 ? 320 : SW * 0.78;

const CATEGORIES = [
  { name: 'Vehicles',          image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&q=80' },
  { name: 'Plant & Equipment', image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80' },
  { name: 'Livestock',         image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&q=80' },
  { name: 'Property',          image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80' },
  { name: 'Industrial',        image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=80' },
  { name: 'Household',         image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80' },
  { name: 'Electronics',       image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&q=80' },
  { name: 'Collectibles',      image: 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=400&q=80' },
  { name: 'Art & Jewellery',   image: 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=400&q=80' },
];

async function fetchAuctionEvents() {
  const { data } = await supabase
    .from('live_sessions')
    .select('auction_id, title, scheduled_at, status, lot_ids, auctions(title, end_at)')
    .in('status', ['live', 'scheduled'])
    .order('scheduled_at');
  return (data ?? []) as any[];
}

async function fetchLotCovers(auctionIds: string[]) {
  if (!auctionIds.length) return {};
  const { data } = await supabase
    .from('lots')
    .select('auction_id, photos, title')
    .in('auction_id', auctionIds)
    .neq('photos', '{}')
    .limit(60);
  // Collect up to 4 photos per auction for the collage
  const map: Record<string, string[]> = {};
  for (const l of data ?? []) {
    if (!l.photos?.[0]) continue;
    if (!map[l.auction_id]) map[l.auction_id] = [];
    if (map[l.auction_id].length < 4) map[l.auction_id].push(l.photos[0]);
  }
  return map;
}

const FALLBACK = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80';

function PhotoCollage({ photos }: { photos: string[] }) {
  const p = photos.length;
  if (p === 0) return <Image source={{ uri: FALLBACK }} style={s.eventImg} resizeMode="cover" />;
  if (p === 1) return <Image source={{ uri: photos[0] }} style={s.eventImg} resizeMode="cover" />;
  if (p === 2) return (
    <View style={s.collageRow}>
      <Image source={{ uri: photos[0] }} style={s.collageHalf} resizeMode="cover" />
      <View style={s.collageDivider} />
      <Image source={{ uri: photos[1] }} style={s.collageHalf} resizeMode="cover" />
    </View>
  );
  // 3 or 4 photos: big left + stacked right
  return (
    <View style={s.collageRow}>
      <Image source={{ uri: photos[0] }} style={s.collageBig} resizeMode="cover" />
      <View style={s.collageDivider} />
      <View style={{ flex: 1 }}>
        <Image source={{ uri: photos[1] }} style={s.collageSmall} resizeMode="cover" />
        <View style={s.collageDividerH} />
        <Image source={{ uri: photos[2] ?? photos[1] }} style={s.collageSmall} resizeMode="cover" />
        {p >= 4 && (
          <>
            <View style={s.collageDividerH} />
            <Image source={{ uri: photos[3] }} style={s.collageSmall} resizeMode="cover" />
          </>
        )}
      </View>
    </View>
  );
}

function AuctionEventCard({ session, photos }: { session: any; photos?: string[] }) {
  const isLive = session.status === 'live';
  const dt = session.scheduled_at ? new Date(session.scheduled_at) : null;
  const dateStr = dt ? dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const timeStr = dt ? dt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '';
  const lotCount = session.lot_ids?.length ?? 0;
  const title = session.title ?? session.auctions?.title ?? 'Auction Event';

  return (
    <Pressable style={s.eventCard} onPress={() => router.push(`/live/${session.auction_id}`)}>
      {/* Photo collage from actual lot images */}
      <PhotoCollage photos={photos ?? []} />
      <View style={s.eventImgOverlay} />
      {isLive && (
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveBadgeTxt}>LIVE NOW</Text>
        </View>
      )}
      <View style={s.eventContent}>
        {dt && !isLive && <Text style={s.eventDate}>{dateStr.toUpperCase()}</Text>}
        <Text style={s.eventTitle} numberOfLines={2}>{title}</Text>
        <View style={s.eventMeta}>
          {timeStr && !isLive && <Text style={s.eventMetaTxt}>🕙 {timeStr}</Text>}
          {lotCount > 0 && <Text style={s.eventMetaTxt}>🔨 {lotCount} lot{lotCount !== 1 ? 's' : ''}</Text>}
        </View>
        <View style={s.eventBtn}>
          <Text style={s.eventBtnTxt}>View Auction →</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const { bg, ink, muted, border } = useAppTheme();

  const { data: events, isRefetching, refetch } = useQuery({
    queryKey: ['auction-events'],
    queryFn: fetchAuctionEvents,
    refetchInterval: 15000,
  });

  const auctionIds = (events ?? []).map((e: any) => e.auction_id);
  const { data: covers } = useQuery({
    queryKey: ['lot-covers', auctionIds.join(',')],
    queryFn: () => fetchLotCovers(auctionIds),
    enabled: auctionIds.length > 0,
  }); // covers: Record<auctionId, string[]>

  const liveEvents = (events ?? []).filter((e: any) => e.status === 'live');
  const upcomingEvents = (events ?? []).filter((e: any) => e.status === 'scheduled');

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.gold} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={s.header}>
          <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.headerTitle}>West Coast Pickers</Text>
            <Text style={s.headerSub}>South Africa's Live Auction Marketplace</Text>
          </View>
          <Pressable onPress={refetch} style={s.refreshBtn}>
            <Text style={{ fontSize: 15 }}>{isRefetching ? '⏳' : '🔄'}</Text>
          </Pressable>
        </View>

        {profile && (
          <View style={[s.welcomeBar, { borderBottomColor: border }]}>
            <Text style={[s.welcomeTxt, { color: muted }]}>Welcome back, <Text style={{ color: Colors.gold, fontWeight: '700' }}>{profile.full_name.split(' ')[0]}</Text></Text>
          </View>
        )}

        {/* ── LIVE NOW ── */}
        {liveEvents.length > 0 && (
          <View style={s.section}>
            {liveEvents.map((e: any) => (
              <Pressable key={e.auction_id} onPress={() => router.push(`/live/${e.auction_id}`)} style={s.liveBanner}>
                <View style={s.livePulse} />
                <View style={{ flex: 1 }}>
                  <Text style={s.liveBannerTitle}>🔴 AUCTION LIVE NOW</Text>
                  <Text style={s.liveBannerSub}>{e.title ?? e.auctions?.title ?? 'Live Auction'} — Tap to join</Text>
                </View>
                <Text style={{ fontSize: 22 }}>🔊</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── UPCOMING AUCTIONS ── */}
        {upcomingEvents.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: ink }]}>Upcoming Auctions</Text>
              <View style={s.goldLine} />
            </View>
            <FlatList
              data={upcomingEvents}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item: any) => item.auction_id}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
              renderItem={({ item }: any) => (
                <AuctionEventCard session={item} photos={covers?.[item.auction_id]} />
              )}
            />
          </View>
        )}

        {/* ── NO EVENTS PLACEHOLDER ── */}
        {(!events || events.length === 0) && (
          <View style={s.emptyEvents}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🔨</Text>
            <Text style={[s.emptyTitle, { color: ink }]}>No auctions scheduled yet</Text>
            <Text style={[s.emptyBody, { color: muted }]}>Check back soon — new events are added regularly.</Text>
          </View>
        )}

        {/* ── BROWSE BY CATEGORY ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: ink }]}>Browse by Category</Text>
            <View style={s.goldLine} />
          </View>
          <View style={[s.catGrid, { paddingHorizontal: 16 }]}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.name}
                onPress={() => router.push({ pathname: '/(tabs)/search', params: { category: cat.name } })}
                style={s.catTile}
              >
                <Image source={{ uri: cat.image }} style={s.catTileImg} resizeMode="cover" />
                <View style={s.catTileOverlay} />
                <Text style={s.catTileName}>{cat.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { backgroundColor: Colors.navy, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  logo: { width: 52, height: 52 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  headerSub: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 },
  refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(196,154,34,0.15)' },

  welcomeBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  welcomeTxt: { fontSize: 13 },

  // Live banner
  liveBanner: { backgroundColor: Colors.navy, borderWidth: 1.5, borderColor: '#DC2626', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  livePulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#DC2626' },
  liveBannerTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  liveBannerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2, marginBottom: 6 },
  goldLine: { width: 36, height: 3, backgroundColor: Colors.gold, borderRadius: 2 },

  // Auction event card
  eventCard: { width: CARD_W, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.navy },
  eventImg: { width: '100%', height: 180 },
  eventImgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,27,46,0.45)', top: 0, height: 180 },
  // Collage layouts
  collageRow: { flexDirection: 'row', height: 180 },
  collageDivider: { width: 2, backgroundColor: Colors.navy },
  collageDividerH: { height: 2, backgroundColor: Colors.navy },
  collageHalf: { flex: 1, height: 180 },
  collageBig: { flex: 1.4, height: 180 },
  collageSmall: { flex: 1 },
  liveBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  eventContent: { padding: 14 },
  eventDate: { color: Colors.gold, fontWeight: '700', fontSize: 11, letterSpacing: 0.8, marginBottom: 6 },
  eventTitle: { color: '#fff', fontWeight: '800', fontSize: 16, lineHeight: 22, marginBottom: 8 },
  eventMeta: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  eventMetaTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  eventBtn: { backgroundColor: Colors.gold, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  eventBtnTxt: { color: Colors.navy, fontWeight: '800', fontSize: 14 },

  // Empty state
  emptyEvents: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Category grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catTile: { width: (SW - 42) / 2, height: 96, borderRadius: 12, overflow: 'hidden' },
  catTileImg: { width: '100%', height: '100%' },
  catTileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,27,46,0.52)' },
  catTileName: { position: 'absolute', bottom: 10, left: 10, right: 10, color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
});
