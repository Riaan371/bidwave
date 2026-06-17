import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/auth-store';
import { useAppTheme, Colors } from '../lib/theme';
import CountdownTimer from './CountdownTimer';

export function formatZAR(amount: number | null | undefined) {
  if (amount == null) return '—';
  return `R${amount.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

export type LotCardData = {
  id: string; title: string; photos: string[];
  starting_bid: number; current_bid: number | null;
  category?: string | null; end_at?: string | null;
};

export default function LotCard({ lot, index = 0, isWatched }: { lot: LotCardData; index?: number; isWatched?: boolean }) {
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const { card, border, ink, muted } = useAppTheme();

  const toggleWatch = useMutation({
    mutationFn: async () => {
      if (!session) { router.push('/(auth)/role'); return; }
      if (isWatched) {
        await supabase.from('watchlist').delete().eq('user_id', session.user.id).eq('lot_id', lot.id);
      } else {
        await supabase.from('watchlist').insert({ user_id: session.user.id, lot_id: lot.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <Pressable onPress={() => router.push(`/lot/${lot.id}`)} style={[s.card, { backgroundColor: card, borderColor: border }]}>
        <View>
          <Image source={{ uri: lot.photos?.[0] }} style={s.img} resizeMode="cover" />
          {lot.category && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{lot.category}</Text>
            </View>
          )}
        </View>
        <View style={s.info}>
          <View style={s.row}>
            <Text style={[s.title, { color: ink }]} numberOfLines={1}>{lot.title}</Text>
            <Pressable onPress={() => toggleWatch.mutate()} hitSlop={10}>
              <Text style={{ fontSize: 20 }}>{isWatched ? '❤️' : '🤍'}</Text>
            </Pressable>
          </View>
          <Text style={[s.bidLabel, { color: muted }]}>Current bid</Text>
          <Text style={s.bidAmt}>{formatZAR(lot.current_bid ?? lot.starting_bid)}</Text>
          {lot.end_at && <CountdownTimer endAt={lot.end_at} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  img: { width: 112, height: 112 },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  info: { flex: 1, padding: 12, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  title: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  bidLabel: { fontSize: 11, marginBottom: 2 },
  bidAmt: { fontSize: 18, fontWeight: '800', color: Colors.primary },
});
