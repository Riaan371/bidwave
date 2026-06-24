import { View, Text, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { useAppTheme, Colors } from '../../lib/theme';
import { requestNotificationPermission, getNotificationPermission } from '../../lib/onesignal';
import { shouldShowInstallPrompt, markInstallPromptShown } from '../../lib/install-prompt';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW > 600 ? 320 : SW * 0.78;


async function fetchAuctionEvents() {
  // Live sessions (live + scheduled)
  const { data: sessions } = await supabase
    .from('live_sessions')
    .select('auction_id, title, scheduled_at, status, lot_ids, auctions(title, end_at, auction_type)')
    .in('status', ['live', 'scheduled'])
    .order('scheduled_at');

  // Timed auctions — all active ones (end_at may be null or future)
  const { data: timed } = await supabase
    .from('auctions')
    .select('id, title, end_at, type, status')
    .eq('type', 'timed')
    .eq('status', 'active')
    .order('end_at');

  const timedMapped = (timed ?? []).map((a: any) => ({
    auction_id: a.id,
    title: a.title,
    scheduled_at: a.end_at,
    status: 'timed',
    lot_ids: null,
    auctions: { title: a.title, end_at: a.end_at, auction_type: 'timed' },
  }));

  return [...(sessions ?? []), ...timedMapped] as any[];
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

function timeUntil(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hrs}h remaining`;
  if (hrs > 0) return `${hrs}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

function AuctionEventCard({ session, photos }: { session: any; photos?: string[] }) {
  const isLive = session.status === 'live';
  const isTimed = session.status === 'timed';
  const dt = session.scheduled_at ? new Date(session.scheduled_at) : null;
  const dateStr = dt ? dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const timeStr = dt ? dt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '';
  const lotCount = session.lot_ids?.length ?? 0;
  const title = session.title ?? session.auctions?.title ?? 'Auction Event';

  return (
    <Pressable style={s.eventCard} onPress={() => isTimed
      ? router.push(`/auction/${session.auction_id}`)
      : router.push(`/live/${session.auction_id}`)
    }>
      <PhotoCollage photos={photos ?? []} />
      <View style={s.eventImgOverlay} />
      {isLive && (
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveBadgeTxt}>LIVE NOW</Text>
        </View>
      )}
      {isTimed && (
        <View style={[s.liveBadge, { backgroundColor: Colors.navy, borderWidth: 1, borderColor: Colors.gold }]}>
          <Text style={[s.liveBadgeTxt, { color: Colors.gold }]}>⏱ TIMED</Text>
        </View>
      )}
      {!isTimed && !isLive && (
        <View style={[s.liveBadge, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#DC2626' }]}>
          <Text style={[s.liveBadgeTxt, { color: '#DC2626' }]}>🔴 LIVE EVENT</Text>
        </View>
      )}
      <View style={s.eventContent}>
        {isTimed && dt && (
          <Text style={s.eventDate}>{timeUntil(dt.toISOString()).toUpperCase()}</Text>
        )}
        {!isTimed && dt && !isLive && <Text style={s.eventDate}>{dateStr.toUpperCase()}</Text>}
        <Text style={s.eventTitle} numberOfLines={2}>{title}</Text>
        <View style={s.eventMeta}>
          {isTimed && dt && <Text style={s.eventMetaTxt}>🗓 Closes {dateStr}</Text>}
          {timeStr && !isLive && !isTimed && <Text style={s.eventMetaTxt}>🕙 {timeStr}</Text>}
          {lotCount > 0 && <Text style={s.eventMetaTxt}>🔨 {lotCount} lot{lotCount !== 1 ? 's' : ''}</Text>}
        </View>
        <View style={s.eventBtn}>
          <Text style={s.eventBtnTxt}>{isTimed ? 'Bid Now →' : 'View Auction →'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const { bg, ink, muted, border } = useAppTheme();

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showNotifAsk, setShowNotifAsk] = useState(false);
  const [showInstallTakeover, setShowInstallTakeover] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    (async () => {
      const perm = await getNotificationPermission();
      const dismissed = window.localStorage.getItem('wcp-notif-dismissed');
      if (!cancelled && perm === 'default' && !dismissed) {
        setTimeout(() => setShowNotifAsk(true), 2500);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleEnableNotifications = async () => {
    setShowNotifAsk(false);
    await requestNotificationPermission();
  };

  const handleDismissNotifAsk = () => {
    setShowNotifAsk(false);
    if (typeof window !== 'undefined') window.localStorage.setItem('wcp-notif-dismissed', '1');
  };
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Detect if already running as installed PWA (works on both iOS and Android/Chrome)
  const isInStandalone = typeof window !== 'undefined' && (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Proactively offer install: immediately on a first-ever visit, or later
  // once the user has shown real engagement (viewed 2+ lots / placed a bid).
  // iOS never fires beforeinstallprompt, so it qualifies as soon as we know
  // the platform; Android/desktop Chrome waits for the deferred event.
  useEffect(() => {
    if (isInStandalone) return;
    if (!isIOS && !installPrompt) return;
    if (!shouldShowInstallPrompt()) return;
    const t = setTimeout(() => setShowInstallTakeover(true), 1500);
    return () => clearTimeout(t);
  }, [isIOS, installPrompt, isInStandalone]);

  const dismissInstallTakeover = () => {
    setShowInstallTakeover(false);
    markInstallPromptShown();
  };

  const acceptInstallTakeover = async () => {
    markInstallPromptShown();
    setShowInstallTakeover(false);
    if (isIOS) { setShowIOSGuide(true); return; }
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
  };

  const handleInstall = async () => {
    if (isIOS) { setShowIOSGuide(true); return; }
    if (!installPrompt) { setShowIOSGuide(true); return; }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
  };

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
  const upcomingEvents = (events ?? []).filter((e: any) => e.status === 'scheduled' || e.status === 'timed');

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
            <Text style={s.headerTitle}>West Coast Picker</Text>
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

        {/* ── INSTALL BANNER ── */}
        {/* Install App banner — always visible unless already installed */}
        {!isInStandalone && (
          <View style={s.installBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.installTitle}>📲 Install App</Text>
              <Text style={s.installSub}>Add West Coast Picker to your home screen</Text>
            </View>
            <Pressable onPress={handleInstall} style={s.installBtn}>
              <Text style={s.installBtnTxt}>Install</Text>
            </Pressable>
          </View>
        )}

        {/* Soft-ask: explain value before triggering the real browser permission prompt */}
        {showNotifAsk && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 999, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🔔</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.navy, marginBottom: 8, textAlign: 'center' }}>Never miss an auction</Text>
              <Text style={{ color: '#374151', fontSize: 14, lineHeight: 20, marginBottom: 20, textAlign: 'center' }}>
                Get notified the moment a new auction opens or a live event starts — so you never lose out on a bid.
              </Text>
              <Pressable onPress={handleEnableNotifications} style={{ backgroundColor: Colors.gold, borderRadius: 10, padding: 14, alignItems: 'center', width: '100%', marginBottom: 10 }}>
                <Text style={{ color: Colors.navy, fontWeight: '800' }}>Enable Notifications</Text>
              </Pressable>
              <Pressable onPress={handleDismissNotifAsk} style={{ padding: 8 }}>
                <Text style={{ color: '#9CA3AF', fontSize: 13 }}>Not now</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Proactive install takeover — first visit, or after engagement on later visits */}
        {showInstallTakeover && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 999, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📲</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.navy, marginBottom: 8, textAlign: 'center' }}>
                Install West Coast Picker
              </Text>
              <Text style={{ color: '#374151', fontSize: 14, lineHeight: 20, marginBottom: 20, textAlign: 'center' }}>
                Get one-tap access from your home screen — faster loading, live auction alerts, no browser tabs to dig through.
              </Text>
              <Pressable onPress={acceptInstallTakeover} style={{ backgroundColor: Colors.gold, borderRadius: 10, padding: 14, alignItems: 'center', width: '100%', marginBottom: 10 }}>
                <Text style={{ color: Colors.navy, fontWeight: '800' }}>Install Now</Text>
              </Pressable>
              <Pressable onPress={dismissInstallTakeover} style={{ padding: 8 }}>
                <Text style={{ color: '#9CA3AF', fontSize: 13 }}>Maybe later</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* iOS install guide modal */}
        {showIOSGuide && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 999, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.navy, marginBottom: 8 }}>Install on iPhone / iPad</Text>
              <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
                1. Tap the <Text style={{ fontWeight: '700' }}>Share</Text> button at the bottom of Safari {'\n'}
                2. Scroll down and tap <Text style={{ fontWeight: '700' }}>"Add to Home Screen"</Text>{'\n'}
                3. Tap <Text style={{ fontWeight: '700' }}>Add</Text> — done!
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 16 }}>
                On Android (Chrome): tap the 3-dot menu → "Add to Home screen"
              </Text>
              <Pressable onPress={() => setShowIOSGuide(false)} style={{ backgroundColor: Colors.navy, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Got it</Text>
              </Pressable>
            </View>
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
              <Text style={[s.sectionTitle, { color: ink }]}>Active Auctions</Text>
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
  installBanner: { backgroundColor: Colors.navy, borderBottomWidth: 2, borderBottomColor: Colors.gold, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  installTitle: { color: '#fff', fontWeight: '800', fontSize: 13 },
  installSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
  installBtn: { backgroundColor: Colors.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  installBtnTxt: { color: Colors.navy, fontWeight: '800', fontSize: 13 },
  installDismiss: { padding: 4 },

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
