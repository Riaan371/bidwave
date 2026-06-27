import { View, Text, Pressable, ScrollView, Image, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/auth-store';
import { useAppTheme, Colors } from '../lib/theme';
import { formatZAR } from '../components/LotCard';

type AuctionType = 'timed' | 'live';

export default function ScheduleLive() {
  const session = useAuthStore((s) => s.session);
  const { bg, card, border, ink, muted, input } = useAppTheme();
  const queryClient = useQueryClient();

  const [auctionType, setAuctionType] = useState<AuctionType>('timed');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [pickedLots, setPickedLots] = useState<{ id: string; title: string; photos: string[]; current_bid: number | null; starting_bid: number }[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useFocusEffect(useCallback(() => {
    const picked = (global as any).__pickedLots;
    if (picked && picked.length > 0) {
      setPickedLots(picked);
      (global as any).__pickedLots = null;
      (global as any).__pickedLotIds = null;
    }
  }, []));

  const removeLot = (id: string) => setPickedLots((prev) => prev.filter((l) => l.id !== id));

  const parseDateTime = (): string | null => {
    if (!date) return null;
    if (date.length !== 8) throw new Error('Enter the date as DDMMYYYY (8 digits)');
    const d = date.slice(0, 2);
    const m = date.slice(2, 4);
    const y = date.slice(4, 8);
    const h = hour || '18';
    const min = minute || '00';
    const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
    if (isNaN(dt.getTime())) throw new Error('Invalid date — use DDMMYYYY');
    return dt.toISOString();
  };

  const schedule = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Not logged in');
      if (!title.trim()) throw new Error('Please enter an auction title');
      if (pickedLots.length === 0) throw new Error('Please select at least one lot');

      const deadlineAt = parseDateTime();
      if (auctionType === 'timed' && !deadlineAt) throw new Error('Please enter a closing date for the timed auction');

      // 1. Create auction record
      const { data: auction, error: auctionErr } = await supabase
        .from('auctions')
        .insert({
          title: title.trim(),
          auctioneer_id: session.user.id,
          type: auctionType,
          status: auctionType === 'timed' ? 'active' : 'scheduled',
          end_at: deadlineAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();
      if (auctionErr) throw new Error('Failed to create auction: ' + auctionErr.message);

      const auctionId = auction.id;
      const lotIds = pickedLots.map((l) => l.id);

      // 2. Link lots to this auction
      const { error: lotsErr } = await supabase.from('lots').update({ auction_id: auctionId }).in('id', lotIds);
      if (lotsErr) throw new Error('Failed to link lots: ' + lotsErr.message);

      // 3. For live auctions only: create a live session
      if (auctionType === 'live') {
        const scheduledAt = parseDateTime();
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
        if (sessionErr) throw new Error('Failed to create live session: ' + sessionErr.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction-events'] });
      queryClient.invalidateQueries({ queryKey: ['timed-auctions'] });
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['auctioneer-lots'] });
      setMsg({ text: '✅ Auction published! Redirecting to home...', ok: true });
      setTimeout(() => router.replace('/(tabs)'), 2000);
    },
    onError: (e: any) => {
      setMsg({ text: '❌ ' + e.message, ok: false });
    },
  });

  const inputStyle = [s.input, { backgroundColor: input, borderColor: border, color: ink }];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Create Auction',
        headerStyle: { backgroundColor: Colors.navy },
        headerTintColor: '#fff',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontSize: 15 }}>← Back</Text>
          </Pressable>
        ),
      }} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>

        {/* Auction Type Toggle */}
        <View style={[s.card, { backgroundColor: card, borderColor: border, marginBottom: 16 }]}>
          <Text style={[s.sectionTitle, { color: ink }]}>Auction Type</Text>
          <View style={s.typeRow}>
            <Pressable
              onPress={() => setAuctionType('timed')}
              style={[s.typeBtn, auctionType === 'timed' && s.typeBtnActive]}
            >
              <Text style={[s.typeIcon]}>⏱</Text>
              <Text style={[s.typeName, { color: auctionType === 'timed' ? Colors.navy : ink }]}>Timed Auction</Text>
              <Text style={[s.typeDesc, { color: auctionType === 'timed' ? Colors.navy : muted }]}>
                Always online — bidders bid anytime until deadline
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAuctionType('live')}
              style={[s.typeBtn, auctionType === 'live' && s.typeBtnActive]}
            >
              <Text style={[s.typeIcon]}>🔴</Text>
              <Text style={[s.typeName, { color: auctionType === 'live' ? Colors.navy : ink }]}>Live Auction</Text>
              <Text style={[s.typeDesc, { color: auctionType === 'live' ? Colors.navy : muted }]}>
                Real-time event — you host, bidders join live
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Auction Details */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.sectionTitle, { color: ink }]}>Auction Details</Text>

          <Text style={[s.label, { color: muted }]}>Auction Title *</Text>
          <TextInput value={title} onChangeText={setTitle}
            placeholder='e.g. "Vehicle Auction — July 2026"'
            placeholderTextColor="#9CA3AF" style={[inputStyle, s.mb]} />

          <Text style={[s.label, { color: muted }]}>
            {auctionType === 'timed' ? 'Closing Date (DDMMYYYY) *' : 'Event Date (DDMMYYYY)'}
          </Text>
          <TextInput value={date} onChangeText={(v) => setDate(v.replace(/[^0-9]/g, '').slice(0, 8))} placeholder="30062026"
            placeholderTextColor="#9CA3AF" keyboardType="numeric" maxLength={8} style={[inputStyle, s.mb]} />

          <Text style={[s.label, { color: muted }]}>
            {auctionType === 'timed' ? 'Closing Time *' : 'Event Time'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput value={hour} onChangeText={(v) => setHour(v.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="18" placeholderTextColor="#9CA3AF" keyboardType="number-pad"
              maxLength={2} style={[inputStyle, { flex: 1, textAlign: 'center' }]} />
            <Text style={{ fontSize: 22, fontWeight: '800', color: ink }}>:</Text>
            <TextInput value={minute} onChangeText={(v) => setMinute(v.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="00" placeholderTextColor="#9CA3AF" keyboardType="number-pad"
              maxLength={2} style={[inputStyle, { flex: 1, textAlign: 'center' }]} />
          </View>
          <Text style={{ color: muted, fontSize: 12, marginTop: 6 }}>
            {auctionType === 'timed' ? 'Bidding closes at this time.' : 'Leave blank to go live immediately.'}
          </Text>
        </View>

        {/* Lot selection */}
        <View style={[s.card, { backgroundColor: card, borderColor: border, marginTop: 16 }]}>
          <Text style={[s.sectionTitle, { color: ink }]}>Lots on the Block</Text>
          <Text style={{ color: muted, fontSize: 13, marginBottom: 14 }}>
            {auctionType === 'timed'
              ? 'Select lots from your inventory. All lots will be visible to bidders immediately.'
              : 'Select lots from your inventory. Lots go one-by-one during your live session.'}
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

      {msg && (
        <View style={[s.msgBanner, { backgroundColor: msg.ok ? '#16A34A' : '#DC2626' }]}>
          <Text style={s.msgTxt}>{msg.text}</Text>
        </View>
      )}

      <View style={[s.footer, { backgroundColor: bg, borderTopColor: border }]}>
        <Pressable
          onPress={() => schedule.mutate()}
          disabled={schedule.isPending}
          style={[s.submitBtn, { opacity: schedule.isPending ? 0.7 : 1 }]}
        >
          {schedule.isPending
            ? <ActivityIndicator color={Colors.navy} />
            : <Text style={s.submitBtnTxt}>
                {auctionType === 'timed' ? '⏱ Publish Timed Auction' : '🔴 Schedule Live Auction'}
              </Text>}
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
  // Type toggle
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, alignItems: 'center' },
  typeBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  typeIcon: { fontSize: 24, marginBottom: 6 },
  typeName: { fontWeight: '800', fontSize: 14, marginBottom: 4 },
  typeDesc: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  // Lot picker
  pickBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 14 },
  lotRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  lotNum: { fontSize: 13, fontWeight: '700', width: 26 },
  lotThumb: { width: 50, height: 50, borderRadius: 8 },
  lotTitle: { fontSize: 13, fontWeight: '600' },
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  msgBanner: { position: 'absolute', bottom: 80, left: 16, right: 16, borderRadius: 12, padding: 14 },
  msgTxt: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 14 },
  submitBtn: { backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitBtnTxt: { color: Colors.navy, fontWeight: '800', fontSize: 16 },
});
