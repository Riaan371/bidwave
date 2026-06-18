import { View, StyleSheet, Platform } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useAppTheme } from '../lib/theme';

// Web: simple CSS opacity pulse via state; Native: Reanimated
function Shimmer({ width, height, radius = 10 }: { width: number | string; height: number; radius?: number }) {
  const { dark } = useAppTheme();
  const bg = dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';

  if (Platform.OS === 'web') {
    const [opacity, setOpacity] = useState(0.4);
    const up = useRef(true);
    useEffect(() => {
      const t = setInterval(() => {
        setOpacity((o) => {
          if (o >= 1) { up.current = false; return 0.95; }
          if (o <= 0.3) { up.current = true; return 0.35; }
          return up.current ? o + 0.05 : o - 0.05;
        });
      }, 40);
      return () => clearInterval(t);
    }, []);
    return <View style={{ width: width as number, height, borderRadius: radius, backgroundColor: bg, opacity }} />;
  }

  // Native: use Reanimated
  const { default: Animated, useAnimatedStyle, useSharedValue, withRepeat, withTiming } = require('react-native-reanimated');
  const opacityVal = useSharedValue(0.4);
  useEffect(() => { opacityVal.value = withRepeat(withTiming(1, { duration: 700 }), -1, true); }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacityVal.value }));
  return <Animated.View style={[{ width: width as number, height, borderRadius: radius, backgroundColor: bg }, animStyle]} />;
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
