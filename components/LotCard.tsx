import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/auth-store';
import { useAppTheme, Colors } from '../lib/theme';
import CountdownTimer from './CountdownTimer';

// Reanimated only on native — crashes on web in production builds
let Animated: any = View;
let FadeInDown: any = null;
if (Platform.OS !== 'web') {
  const R = require('react-native-reanimated');
  Animated = R.default;
  FadeInDown = R.FadeInDown;
}

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

  const entering = FadeInDown ? FadeInDown.delay(index * 60).duration(350) : undefined;

  return (
    <View entering={entering}>
      <Pressable onPress={() => router.push(`/lot/${lot.id}`)} style={[s.card, { backgroundColor: card, borderBottomColor: border }]}>
        <Image source={{ uri: lot.photos?.[0] }} style={s.img} resizeMode="cover" />
        <View style={s.info}>
          {lot.category && <Text style={[s.category, { color: muted }]}>{lot.category.toUpperCase()}</Text>}
          <Text style={[s.title, { color: ink }]} numberOfLines={2}>{lot.title}</Text>
          <View style={s.bottomRow}>
            <View>
              <Text style={[s.bidLabel, { color: muted }]}>Current bid</Text>
              <Text style={s.bidAmt}>{formatZAR(lot.current_bid ?? lot.starting_bid)}</Text>
              {lot.end_at && <CountdownTimer endAt={lot.end_at} />}
            </View>
            <Pressable onPress={() => toggleWatch.mutate()} hitSlop={12} style={s.heartBtn}>
              <MaterialIcons name={isWatched ? 'favorite' : 'favorite-border'} size={22} color={isWatched ? '#ef4444' : muted} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', borderBottomWidth: 1, overflow: 'hidden' },
  img: { width: 100, height: 100 },
  info: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'space-between' },
  category: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 20, flex: 1 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  bidLabel: { fontSize: 10, marginBottom: 1 },
  bidAmt: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  heartBtn: { padding: 4 },
});
