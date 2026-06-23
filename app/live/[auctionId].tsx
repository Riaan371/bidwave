import { View, Text, Pressable, ActivityIndicator, Alert, Platform, StyleSheet, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { useAppTheme, Colors } from '../../lib/theme';
import { getAgoraToken, markSessionLive, markSessionEnded } from '../../lib/agora';
import { formatZAR } from '../../components/LotCard';

const APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '';
type AgoraClient = any;
type AgoraTrack = any;

export default function LiveRoom() {
  const { auctionId } = useLocalSearchParams<{ auctionId: string }>();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const { bg, card, border, ink, muted } = useAppTheme();

  const isHost = profile?.role === 'auctioneer';
  const clientRef = useRef<AgoraClient>(null);
  const micTrackRef = useRef<AgoraTrack>(null);

  const [status, setStatus] = useState<'idle' | 'joining' | 'live' | 'ended'>('idle');
  const [micOn, setMicOn] = useState(true);
  const [listenerCount, setListenerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [lotIndex, setLotIndex] = useState(0);

  // Track the session's real status (scheduled/live/ended) regardless — used to gate bidder access
  const { data: sessionInfo } = useQuery({
    queryKey: ['live-session-status', auctionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_sessions').select('status, scheduled_at, title')
        .eq('auction_id', auctionId).maybeSingle();
      return data;
    },
    refetchInterval: 5000,
  });

  const sessionIsLive = sessionInfo?.status === 'live';
  const canAccess = isHost || sessionIsLive;

  // Preview lots (photos + starting bid only) shown while waiting for the live session to start
  const { data: previewLots } = useQuery({
    queryKey: ['live-preview-lots', auctionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lots').select('id, title, photos, starting_bid, category')
        .eq('auction_id', auctionId).order('created_at');
      return data ?? [];
    },
    enabled: !canAccess,
  });

  const { data: liveSession } = useQuery({
    queryKey: ['live-session-detail', auctionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_sessions').select('lot_ids, current_lot_index, title')
        .eq('auction_id', auctionId).eq('status', 'live').maybeSingle();
      return data;
    },
    enabled: canAccess,
    refetchInterval: 3000,
    onSuccess: (data) => { if (data?.current_lot_index != null) setLotIndex(data.current_lot_index); },
  });

  const activeLotId = liveSession?.lot_ids?.[lotIndex] ?? null;

  const { data: currentLot } = useQuery({
    queryKey: ['live-lot', auctionId, activeLotId],
    queryFn: async () => {
      if (activeLotId) {
        const { data } = await supabase.from('lots').select('id, title, current_bid, starting_bid, photos').eq('id', activeLotId).single();
        return data;
      }
      const { data } = await supabase
        .from('lots').select('id, title, current_bid, starting_bid, photos')
        .eq('auction_id', auctionId).is('winner_id', null)
        .order('created_at').limit(1).maybeSingle();
      return data;
    },
    enabled: canAccess,
    refetchInterval: 4000,
  });

  const { data: topBid } = useQuery({
    queryKey: ['live-top-bid', activeLotId],
    queryFn: async () => {
      if (!activeLotId) return null;
      const { data } = await supabase
        .from('bids')
        .select('amount, users(screen_name, full_name)')
        .eq('lot_id', activeLotId)
        .order('amount', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { amount: number; users: { screen_name: string | null; full_name: string } | null } | null;
    },
    enabled: !!activeLotId && canAccess,
    refetchInterval: 3000,
  });

  const totalLots = liveSession?.lot_ids?.length ?? 0;

  async function nextLot() {
    const next = lotIndex + 1;
    if (next >= totalLots) { Alert.alert('Last lot', 'No more lots in this session.'); return; }
    setLotIndex(next);
    await supabase.from('live_sessions').update({ current_lot_index: next }).eq('auction_id', auctionId).eq('status', 'live');
  }

  async function prevLot() {
    const prev = Math.max(0, lotIndex - 1);
    setLotIndex(prev);
    await supabase.from('live_sessions').update({ current_lot_index: prev }).eq('auction_id', auctionId).eq('status', 'live');
  }

  useEffect(() => {
    const channel = supabase
      .channel(`live-bids-${auctionId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-lot', auctionId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [auctionId]);

  async function join() {
    if (Platform.OS !== 'web') {
      Alert.alert('Web only', 'Live audio requires the web app for now.');
      return;
    }
    if (!session) { router.push('/(auth)/role'); return; }
    setStatus('joining'); setError(null);

    // 15-second timeout guard so the UI never gets stuck on "Connecting..."
    const timeoutHandle = setTimeout(() => {
      setError('Connection timed out. Check your network and try again.');
      setStatus('idle');
    }, 15000);

    try {
      const role = isHost ? 'publisher' : 'subscriber';
      const { token } = await getAgoraToken(auctionId, role);
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      AgoraRTC.setLogLevel(3); // warnings only
      const client: AgoraClient = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      clientRef.current = client;
      client.on('user-published', async (user: any, mediaType: string) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') user.audioTrack?.play();
      });
      client.on('user-unpublished', (user: any) => { user.audioTrack?.stop(); });
      client.on('user-joined', () => setListenerCount((c) => c + 1));
      client.on('user-left', () => setListenerCount((c) => Math.max(0, c - 1)));
      await client.setClientRole(isHost ? 'host' : 'audience');
      // token may be null when Agora app is in testing mode (no certificate required)
      await client.join(APP_ID, auctionId, token ?? null, null);
      if (isHost) {
        const mic = await AgoraRTC.createMicrophoneAudioTrack();
        micTrackRef.current = mic;
        await client.publish(mic);
        await markSessionLive(auctionId, session.user.id);
      }
      clearTimeout(timeoutHandle);
      setStatus('live');
    } catch (e: any) {
      clearTimeout(timeoutHandle);
      setError(e.message ?? 'Failed to join');
      setStatus('idle');
    }
  }

  async function leave() {
    micTrackRef.current?.close();
    await clientRef.current?.leave();
    if (isHost) {
      // Close all unsold lots in this session so they disappear from home screen
      if (liveSession?.lot_ids?.length) {
        await supabase
          .from('lots')
          .update({ closed: true, no_sale: true })
          .in('id', liveSession.lot_ids)
          .is('winner_id', null); // only lots not already sold
      }
      await markSessionEnded(auctionId);
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      setStatus('ended');
      router.replace('/(tabs)/');
    } else {
      setStatus('ended');
      router.back();
    }
  }

  async function toggleMic() {
    if (!micTrackRef.current) return;
    await micTrackRef.current.setEnabled(!micOn);
    setMicOn(!micOn);
  }

  useEffect(() => {
    return () => { micTrackRef.current?.close(); clientRef.current?.leave(); };
  }, []);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: '#000' }]}>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Live Auction', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff', headerLeft: () => (
        <Pressable onPress={() => router.push('/(tabs)/')} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontSize: 15 }}>🏠 Home</Text>
        </Pressable>
      ) }} />

      {!canAccess ? (
        <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.waitBanner}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🔒</Text>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
              Bidding Opens When Live
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
              Browse the lots below. Bidding unlocks once the auctioneer starts the session.
            </Text>
            {sessionInfo?.scheduled_at && (
              <Text style={{ color: Colors.gold, fontSize: 15, fontWeight: '700', marginTop: 10, textAlign: 'center' }}>
                📅 {new Date(sessionInfo.scheduled_at).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{'\n'}
                🕙 {new Date(sessionInfo.scheduled_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>

          {(previewLots ?? []).map((lot: any) => (
            <View key={lot.id} style={s.previewLotCard}>
              {lot.photos?.[0] ? (
                <Image source={{ uri: lot.photos[0] }} style={s.previewLotImg} resizeMode="cover" />
              ) : (
                <View style={[s.previewLotImg, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <Text style={{ fontSize: 28 }}>📷</Text>
                </View>
              )}
              <View style={{ flex: 1, padding: 12, opacity: 0.55 }}>
                <Text style={s.previewLotCat}>{lot.category ?? '—'}</Text>
                <Text style={s.previewLotTitle} numberOfLines={2}>{lot.title}</Text>
                <Text style={s.previewLotBid}>Opening Bid: {formatZAR(lot.starting_bid)}</Text>
                <View style={s.previewLockedBadge}>
                  <Text style={s.previewLockedTxt}>🔒 Locked until live</Text>
                </View>
              </View>
            </View>
          ))}

          <Pressable onPress={() => router.push('/(tabs)/')} style={[s.outlineBtn, { marginTop: 12 }]}>
            <Text style={s.outlineBtnTxt}>← Back to Home</Text>
          </Pressable>
        </ScrollView>
      ) : (
      <View style={s.body}>
        {/* Live indicator */}
        <View style={s.liveRow}>
          {status === 'live' ? (
            <>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>LIVE</Text>
              {isHost && <Text style={s.listenerTxt}>{listenerCount} listening</Text>}
            </>
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              {isHost ? 'Start your live auction session' : 'Join the live auction'}
            </Text>
          )}
        </View>

        {/* Current lot */}
        {currentLot && (
          <View style={s.lotCard}>
            {currentLot.photos?.[0] ? (
              <Image source={{ uri: currentLot.photos[0] }} style={s.lotPhoto} resizeMode="cover" />
            ) : null}
            <View style={{ padding: 14 }}>
              {totalLots > 1 && (
                <Text style={s.lotCounter}>LOT {lotIndex + 1} OF {totalLots}</Text>
              )}
              <Text style={s.lotLabel}>NOW ON THE BLOCK</Text>
              <Text style={s.lotTitle}>{currentLot.title}</Text>
              <Text style={s.lotBid}>{formatZAR(currentLot.current_bid ?? currentLot.starting_bid)}</Text>
              {topBid && (
                <View style={{ backgroundColor: 'rgba(22,163,74,0.15)', borderRadius: 8, padding: 8, marginTop: 4, marginBottom: 4 }}>
                  <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 13 }}>
                    🏆 Top bidder: {topBid.users?.screen_name ?? topBid.users?.full_name ?? 'Unknown'}
                  </Text>
                </View>
              )}
              {session && (
                <Pressable onPress={() => router.push(`/lot/${currentLot.id}`)} style={[s.bidBtn, isHost && { backgroundColor: '#16A34A' }]}>
                  <Text style={s.bidBtnTxt}>{isHost ? '📋 View Live Bids' : 'Place a Bid'}</Text>
                </Pressable>
              )}
            </View>
            {/* Auctioneer lot navigation */}
            {isHost && status === 'live' && totalLots > 1 && (
              <View style={s.lotNav}>
                <Pressable onPress={prevLot} disabled={lotIndex === 0} style={[s.navBtn, { opacity: lotIndex === 0 ? 0.3 : 1 }]}>
                  <Text style={s.navBtnTxt}>← Prev</Text>
                </Pressable>
                <Pressable onPress={nextLot} disabled={lotIndex >= totalLots - 1} style={[s.navBtn, { opacity: lotIndex >= totalLots - 1 ? 0.3 : 1 }]}>
                  <Text style={s.navBtnTxt}>Next →</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Audio visualiser */}
        {status === 'live' && (
          <View style={s.visualiser}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 64, gap: 4 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <View key={i} style={{ width: 8, height: 8 + Math.random() * 40, borderRadius: 4, backgroundColor: 'rgba(11,95,255,0.7)' }} />
              ))}
            </View>
            <Text style={s.micStatus}>
              {isHost ? (micOn ? '🎙 Microphone on' : '🔇 Microphone muted') : '🔊 Listening live'}
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        )}

        {/* Controls */}
        <View style={{ gap: 12 }}>
          {status === 'idle' && (
            <Pressable onPress={join} style={s.actionBtn}>
              <Text style={s.actionBtnTxt}>{isHost ? '🎙 Start Live Session' : '🔊 Join Live Audio'}</Text>
            </Pressable>
          )}
          {status === 'joining' && (
            <View style={s.joiningBox}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={{ color: Colors.primary, fontSize: 13, marginTop: 8 }}>Connecting...</Text>
            </View>
          )}
          {status === 'live' && isHost && (
            <>
              <Pressable onPress={toggleMic} style={[s.outlineBtn, !micOn && { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Text style={s.outlineBtnTxt}>{micOn ? '🎙 Mute Mic' : '🔇 Unmute Mic'}</Text>
              </Pressable>
              <Pressable onPress={leave} style={[s.outlineBtn, { borderColor: '#ef4444' }]}>
                <Text style={[s.outlineBtnTxt, { color: '#ef4444' }]}>End Session</Text>
              </Pressable>
            </>
          )}
          {status === 'live' && !isHost && (
            <Pressable onPress={leave} style={s.outlineBtn}>
              <Text style={s.outlineBtnTxt}>Leave</Text>
            </Pressable>
          )}
        </View>

        {isHost && status === 'idle' && (
          <Pressable onPress={leave} style={[s.outlineBtn, { borderColor: '#ef4444', marginTop: 12 }]}>
            <Text style={[s.outlineBtnTxt, { color: '#ef4444' }]}>End Session</Text>
          </Pressable>
        )}
      </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 8 },
  liveTxt: { color: '#ef4444', fontWeight: '800', fontSize: 13, letterSpacing: 2, marginRight: 12 },
  listenerTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  lotCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
  lotPhoto: { width: '100%', height: 180 },
  lotCounter: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  lotLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  lotTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  lotBid: { color: Colors.primary, fontSize: 26, fontWeight: '800', marginTop: 8 },
  bidBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  bidBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  lotNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  navBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  navBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  visualiser: { alignItems: 'center', marginBottom: 28 },
  micStatus: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 },
  errorBox: { backgroundColor: 'rgba(220,38,38,0.15)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorTxt: { color: '#f87171', fontSize: 13 },
  actionBtn: { backgroundColor: Colors.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  actionBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  joiningBox: { backgroundColor: 'rgba(11,95,255,0.15)', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  outlineBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  outlineBtnTxt: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 15 },
  setupNote: { marginTop: 28, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14 },
  waitBanner: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 18 },
  previewLotCard: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  previewLotImg: { width: 100, height: 100 },
  previewLotCat: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  previewLotTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  previewLotBid: { color: Colors.gold, fontSize: 13, fontWeight: '700' },
  previewLockedBadge: { backgroundColor: 'rgba(220,38,38,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  previewLockedTxt: { color: '#f87171', fontSize: 10, fontWeight: '700' },
});
