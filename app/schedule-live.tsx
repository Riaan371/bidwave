import { View, Text, Pressable, ScrollView, Image, TextInput, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/auth-store';
import { useAppTheme, Colors } from '../lib/theme';
import { formatZAR } from '../components/LotCard';

export default function ScheduleLive() {
  const session = useAuthStore((s) => s.session);
  const { bg, card, border, ink, muted, input } = useAppTheme();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [pickedLots, setPickedLots] = useState<{ id: string; title: string; photos: string[]; current_bid: number | null; starting_bid: number }[]>([]);

  useFocusEffect(useCallback(() => {
    const picked = (global as any).__pickedLots;
    if (picked && picked.length > 0) {
      setPickedLots(picked);
      (global as any).__pickedLots = null;
      (global as any).__pickedLotIds = null;
    }
  }, []));

  const removeLot = (id: string) => setPickedLots((prev) => prev.filter((l) => l.id !== id));

  const schedule = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Not logged in');
      if (!title.trim()) throw new Error('Please enter an auction title');
      if (pickedLots.length === 0) throw new Error('Please select at least one lot');

      let scheduledAt: string | null = null;
      if (date && time) {
        const [d, m, y] = date.split('/');
        const [h, min] = time.split(':');
        const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
        if (isNaN(dt.getTime())) throw new Error('Invalid date or time format');
        scheduledAt = dt.toISOString();
      }

      // 1. Create a real auction record
      const { data: auction, error: auctionErr } = await supabase
        .from('auctions')
        .insert({
          title: title.trim(),
          auctioneer_id: session.user.id,
          end_at: scheduledAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();
      if (auctionErr) throw new Error('Failed to create auction: ' + auctionErr.message);

      const auctionId = auction.id;
      const lotIds = pickedLots.map((l) => l.id);

      // 2. Link selected lots to this auction
      await supabase.from('lots').update({ auction_id: auctionId }).in('id', lotIds);

      // 3. Create the live session
      const { error: sessionErr } = await supabase.from('live_sessions').insert({
        auction_id: auctionId,
        auctioneer_id: session.user.id,
        channel_name: auctionId,
        status: scheduledAt ? 'scheduled' : 'live',
        scheduled_at: scheduledAt,
        lot_ids: lotIds,
        current_lot_index: 0,
        title: title.trim(),
      });
      if (sessionErr) throw new Error('Failed to create session: ' + sessionErr.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction-events'] });
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['auctioneer-lots'] });
      Alert.alert('Auction Scheduled! 🎉', 'Your auction is now visible on the home screen.', [
        { text: 'View Home', onPress: () => router.replace('/(tabs)') },
        { text: 'Back to Profile', onPress: () => router.replace('/(tabs)/profile') },
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const inputStyle = [s.input, { backgroundColor: input, borderColor: border, color: ink }];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Schedule Live Auction',
        headerStyle: { backgroundColor: Colors.navy },
        headerTintColor: '#fff',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontSize: 15 }}>← Back</Text>
          </Pressable>
        ),
      }} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>

        {/* Session Details */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.sectionTitle, { color: ink }]}>Auction Details</Text>

          <Text style={[s.label, { color: muted }]}>Auction Title *</Text>
          <TextInput value={title} onChangeText={setTitle}
            placeholder='e.g. "Vehicle & Plant Auction — July 2026"'
            placeholderTextColor="#9CA3AF" style={[inputStyle, s.mb]} />

          <Text style={[s.label, { color: muted }]}>Date (DD/MM/YYYY)</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="30/06/2026"
            placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle, s.mb]} />

          <Text style={[s.label, { color: muted }]}>Time (HH:MM)</Text>
          <TextInput value={time} onChangeText={setTime} placeholder="18:00"
            placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle]} />
          <Text style={{ color: muted, fontSize: 12, marginTop: 6 }}>
            Leave blank to go live immediately.
          </Text>
        </View>

        {/* Lot selection */}
        <View style={[s.card, { backgroundColor: card, borderColor: border, marginTop: 16 }]}>
          <Text style={[s.sectionTitle, { color: ink }]}>Lots on the Block</Text>
          <Text style={{ color: muted, fontSize: 13, marginBottom: 14 }}>
            Select lots from your inventory. Bidders will see and bid on these during the live session.
          </Text>

          <Pressable
            onPress={() => router.push({ pathname: '/manage-lots', params: { pick: '1' } })}
            style={[s.pickBtn, { borderColor: Colors.gold }]}
          >
            <Text style={{ color: Colors.gold, fontWeight: '700', fontSize: 14 }}>
              {pickedLots.length > 0
                ? `✓ ${pickedLots.length} lot${pickedLots.length > 1 ? 's' : ''} selected — tap to change`
                : '+ Pick Lots from Inventory'}
            </Text>
          </Pressable>

          {pickedLots.map((lot, i) => (
            <View key={lot.id} style={[s.lotRow, { borderColor: border }]}>
              <Text style={[s.lotNum, { color: muted }]}>#{i + 1}</Text>
              <Image source={{ uri: lot.photos?.[0] || 'https://picsum.photos/56/56' }} style={s.lotThumb} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[s.lotTitle, { color: ink }]} numberOfLines={1}>{lot.title}</Text>
                <Text style={{ color: Colors.gold, fontWeight: '700', fontSize: 13 }}>
                  {formatZAR(lot.current_bid ?? lot.starting_bid)}
                </Text>
              </View>
              <Pressable onPress={() => removeLot(lot.id)} style={s.removeBtn}>
                <Text style={{ color: '#DC2626', fontSize: 22 }}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[s.footer, { backgroundColor: bg, borderTopColor: border }]}>
        <Pressable
          onPress={() => schedule.mutate()}
          disabled={schedule.isPending}
          style={[s.submitBtn, { opacity: schedule.isPending ? 0.7 : 1 }]}
        >
          {schedule.isPending
            ? <ActivityIndicator color={Colors.navy} />
            : <Text style={s.submitBtnTxt}>📅 Publish Auction to Home Screen</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  mb: { marginBottom: 14 },
  pickBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 14 },
  lotRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  lotNum: { fontSize: 13, fontWeight: '700', width: 26 },
  lotThumb: { width: 50, height: 50, borderRadius: 8 },
  lotTitle: { fontSize: 13, fontWeight: '600' },
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 14 },
  submitBtn: { backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitBtnTxt: { color: Colors.navy, fontWeight: '800', fontSize: 16 },
});
