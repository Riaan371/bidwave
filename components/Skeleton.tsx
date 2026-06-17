import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useAppTheme } from '../lib/theme';

function Shimmer({ width, height, radius = 10 }: { width: number | string; height: number; radius?: number }) {
  const { dark } = useAppTheme();
  const opacity = useSharedValue(0.4);
  useEffect(() => { opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true); }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[
      { width: width as number, height, borderRadius: radius },
      { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)' },
      style,
    ]} />
  );
}

export function LotCardSkeleton() {
  const { card, border } = useAppTheme();
  return (
    <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
      <Shimmer width={112} height={112} radius={0} />
      <View style={s.info}>
        <Shimmer width="70%" height={14} />
        <View style={{ height: 8 }} />
        <Shimmer width="40%" height={11} />
        <View style={{ height: 8 }} />
        <Shimmer width="55%" height={18} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => <LotCardSkeleton key={i} />)}
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  info: { flex: 1, padding: 14, justifyContent: 'center' },
});
