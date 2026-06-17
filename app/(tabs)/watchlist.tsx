import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { useAppTheme, Colors } from '../../lib/theme';
import LotCard from '../../components/LotCard';
import { ListSkeleton } from '../../components/Skeleton';

export default function Watchlist() {
  const session = useAuthStore((s) => s.session);
  const { bg, ink, muted } = useAppTheme();

  const { data: lots, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['watchlist', session?.user.id, 'lots'],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select('lot_id, lots(id, title, photos, starting_bid, current_bid, category, auctions(end_at))')
        .eq('user_id', session!.user.id);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({ ...row.lots, end_at: row.lots?.auctions?.end_at }));
    },
  });

  if (!session) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
        <View style={s.header}><Text style={[s.title, { color: ink }]}>Watchlist</Text></View>
        <View style={s.empty}>
          <Text style={[s.emptyTxt, { color: muted }]}>
            Log in to save lots and get notified before they close.
          </Text>
          <Pressable onPress={() => router.push('/(auth)/login')} style={s.btn}>
            <Text style={s.btnTxt}>Log in</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(auth)/role')} style={[s.btn, s.btnOutline]}>
            <Text style={[s.btnTxt, { color: Colors.primary }]}>Create an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <View style={s.header}><Text style={[s.title, { color: ink }]}>Watchlist</Text></View>
      {isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={lots ?? []}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyTxt, { color: muted }]}>
                You haven't saved any lots yet.{'\n'}Tap the heart on a lot to save it here.
              </Text>
            </View>
          }
          renderItem={({ item, index }: any) => (
            <View style={{ paddingHorizontal: 16 }}>
              <LotCard lot={item} index={index} isWatched />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTxt: { fontSize: 15, textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', marginTop: 10, width: '100%' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
