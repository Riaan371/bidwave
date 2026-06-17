import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { useAppTheme, Colors } from '../../lib/theme';
import LotCard from '../../components/LotCard';
import { ListSkeleton } from '../../components/Skeleton';

const CATEGORIES = ['Vehicles', 'Livestock', 'Property', 'Electronics', 'Collectibles', 'Art'];

export default function Search() {
  const params = useLocalSearchParams<{ category?: string }>();
  const session = useAuthStore((s) => s.session);
  const { bg, border, ink, muted, input } = useAppTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(params.category ?? null);

  useEffect(() => { if (params.category) setCategory(params.category); }, [params.category]);

  const { data: lots, isLoading } = useQuery({
    queryKey: ['lots', 'search', query, category],
    queryFn: async () => {
      let req = supabase.from('lots').select('*, auctions(end_at)').order('created_at', { ascending: false });
      if (query.trim()) req = req.or(`title.ilike.%${query.trim()}%,description.ilike.%${query.trim()}%`);
      if (category) req = req.eq('category', category);
      const { data, error } = await req.limit(50);
      if (error) throw error;
      return (data ?? []).map((l: any) => ({ ...l, end_at: l.auctions?.end_at }));
    },
  });

  const { data: watchedIds } = useQuery({
    queryKey: ['watchlist', session?.user.id],
    queryFn: async () => {
      if (!session) return new Set<string>();
      const { data } = await supabase.from('watchlist').select('lot_id').eq('user_id', session.user.id);
      return new Set((data ?? []).map((w) => w.lot_id));
    },
    enabled: !!session,
  });

  const showResults = query.trim().length > 0 || !!category;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: ink }]}>Search</Text>
        <TextInput
          value={query} onChangeText={setQuery}
          placeholder="Search lots, e.g. 'Boerboel puppies'"
          placeholderTextColor="#9CA3AF"
          style={[s.input, { backgroundColor: input, borderColor: border, color: ink }]}
        />
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <Text style={[s.catLabel, { color: muted }]}>Categories</Text>
        <FlatList
          data={CATEGORIES} horizontal showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const active = category === item;
            return (
              <Pressable
                onPress={() => setCategory(active ? null : item)}
                style={[s.chip, { borderColor: active ? Colors.primary : border, backgroundColor: active ? Colors.primary : 'transparent' }]}
              >
                <Text style={[s.chipTxt, { color: active ? '#fff' : ink }]}>{item}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {!showResults ? (
        <View style={s.empty}>
          <Text style={[s.emptyTxt, { color: muted }]}>Search lots by name, or filter by category.</Text>
        </View>
      ) : isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={lots ?? []}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyTxt, { color: muted }]}>
                No results found{query ? ` for "${query}"` : ''}{category ? ` in ${category}` : ''}.
              </Text>
            </View>
          }
          renderItem={({ item, index }: any) => (
            <LotCard lot={item} index={index} isWatched={watchedIds?.has(item.id)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  catLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, marginRight: 8, borderWidth: 1 },
  chipTxt: { fontSize: 13, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: 60 },
  emptyTxt: { fontSize: 15, textAlign: 'center' },
});
