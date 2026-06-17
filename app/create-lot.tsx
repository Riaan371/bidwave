import { View, Text, TextInput, ScrollView, Pressable, Image, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/auth-store';
import { useAppTheme, Colors } from '../lib/theme';

const CATEGORIES = ['Vehicles', 'Livestock', 'Property', 'Electronics', 'Collectibles', 'Art'];

export default function CreateLot() {
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const { bg, card, border, ink, muted, input } = useAppTheme();

  const [images, setImages] = useState<{ uri: string; base64: string | null }[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [startingBid, setStartingBid] = useState('');
  const [reserve, setReserve] = useState('');
  const [buyNow, setBuyNow] = useState('');
  const [increment, setIncrement] = useState('50');

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, base64: true, allowsMultipleSelection: true, selectionLimit: 6,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, base64: a.base64 ?? null }))].slice(0, 6));
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('You must be logged in.');
      if (!title.trim()) throw new Error('Please enter a title.');
      if (images.length === 0) throw new Error('Please add at least one photo.');
      const startBidNum = Number(startingBid);
      if (!startBidNum || startBidNum <= 0) throw new Error('Please enter a valid starting bid.');

      let auctionId: string;
      const { data: existingAuction } = await supabase
        .from('auctions').select('id').eq('auctioneer_id', session.user.id)
        .eq('status', 'active').limit(1).maybeSingle();

      if (existingAuction) {
        auctionId = existingAuction.id;
      } else {
        const { data: newAuction, error: auctionErr } = await supabase.from('auctions').insert({
          auctioneer_id: session.user.id, title: 'My Auction', type: 'timed', status: 'active',
          category: 'mixed', end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }).select('id').single();
        if (auctionErr) throw auctionErr;
        auctionId = newAuction.id;
      }

      const photoUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img.base64) continue;
        const path = `${session.user.id}/${Date.now()}-${i}.jpg`;
        const { error: uploadErr } = await supabase.storage.from('lot-photos')
          .upload(path, decode(img.base64), { contentType: 'image/jpeg' });
        if (uploadErr) throw uploadErr;
        const { data: pub } = supabase.storage.from('lot-photos').getPublicUrl(path);
        photoUrls.push(pub.publicUrl);
      }

      const { error: lotErr } = await supabase.from('lots').insert({
        auction_id: auctionId, title: title.trim(), description: description.trim() || null,
        photos: photoUrls, category, starting_bid: startBidNum,
        reserve: reserve ? Number(reserve) : null, buy_now: buyNow ? Number(buyNow) : null,
        increment: Number(increment) || 50,
      });
      if (lotErr) throw lotErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      Alert.alert('Lot created', 'Your lot has been listed.', [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
    },
    onError: (error: any) => { Alert.alert('Could not create lot', error.message); },
  });

  const inputStyle = [s.input, { backgroundColor: input, borderColor: border, color: ink }];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Create Lot' }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={[s.label, { color: muted }]}>Photos</Text>
        <View style={s.imageRow}>
          {images.map((img, i) => (
            <Image key={i} source={{ uri: img.uri }} style={[s.thumb, { borderColor: border }]} />
          ))}
          {images.length < 6 && (
            <Pressable onPress={pickImage} style={[s.addThumb, { borderColor: border }]}>
              <Text style={{ fontSize: 28, color: muted }}>+</Text>
            </Pressable>
          )}
        </View>

        <Text style={[s.label, { color: muted }]}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g. 2018 Toyota Hilux 2.8 GD-6"
          placeholderTextColor="#9CA3AF" style={[inputStyle, s.mb]} />

        <Text style={[s.label, { color: muted }]}>Description</Text>
        <TextInput value={description} onChangeText={setDescription}
          placeholder="Condition, history, details..." placeholderTextColor="#9CA3AF"
          multiline numberOfLines={4} textAlignVertical="top"
          style={[inputStyle, s.mb, { height: 96 }]} />

        <Text style={[s.label, { color: muted }]}>Category</Text>
        <View style={[s.chipRow, s.mb]}>
          {CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <Pressable key={cat} onPress={() => setCategory(cat)}
                style={[s.chip, { borderColor: active ? Colors.primary : border, backgroundColor: active ? Colors.primary : 'transparent' }]}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: active ? '#fff' : ink }}>{cat}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[s.label, { color: muted }]}>Starting Bid (R)</Text>
        <TextInput value={startingBid} onChangeText={setStartingBid} placeholder="1000"
          placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle, s.mb]} />

        <Text style={[s.label, { color: muted }]}>Bid Increment (R)</Text>
        <TextInput value={increment} onChangeText={setIncrement} placeholder="50"
          placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle, s.mb]} />

        <Text style={[s.label, { color: muted }]}>Reserve Price (R, optional)</Text>
        <TextInput value={reserve} onChangeText={setReserve} placeholder="Optional minimum sale price"
          placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle, s.mb]} />

        <Text style={[s.label, { color: muted }]}>Buy Now Price (R, optional)</Text>
        <TextInput value={buyNow} onChangeText={setBuyNow} placeholder="Optional instant-purchase price"
          placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle, s.mb]} />
      </ScrollView>

      <View style={[s.footer, { backgroundColor: bg, borderTopColor: border }]}>
        <Pressable disabled={submit.isPending} onPress={() => submit.mutate()}
          style={[s.submitBtn, { opacity: submit.isPending ? 0.8 : 1 }]}>
          {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnTxt}>List Lot</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  mb: { marginBottom: 14 },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  thumb: { width: 80, height: 80, borderRadius: 12, borderWidth: 1 },
  addThumb: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 14 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
