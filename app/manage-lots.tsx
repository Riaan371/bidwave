import { View, Text, FlatList, Image, Pressable, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/auth-store';
import { useAppTheme, Colors } from '../lib/theme';
import { formatZAR } from '../components/LotCard';

const CATEGORIES = ['Vehicles', 'Plant & Equipment', 'Livestock', 'Property', 'Industrial', 'Household', 'Electronics', 'Collectibles', 'Art & Jewellery'];

export default function ManageLots() {
  const session = useAuthStore((s) => s.session);
  const { bg, card, border, ink, muted, input } = useAppTheme();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  // If opened from schedule-live, we're in "pick" mode
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const pickMode = pick === '1';
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editingLot, setEditingLot] = useState<any | null>(null);

  // Create lot form state
  const [images, setImages] = useState<{ uri: string; base64: string | null }[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [startingBid, setStartingBid] = useState('');
  const [reserve, setReserve] = useState('');
  const [buyNow, setBuyNow] = useState('');
  const [increment, setIncrement] = useState('500');

  // Edit lot form state
  const [editImages, setEditImages] = useState<{ uri: string; base64: string | null }[]>([]);
  const [editExistingPhotos, setEditExistingPhotos] = useState<string[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState(CATEGORIES[0]);
  const [editStartingBid, setEditStartingBid] = useState('');
  const [editReserve, setEditReserve] = useState('');
  const [editBuyNow, setEditBuyNow] = useState('');
  const [editIncrement, setEditIncrement] = useState('500');

  const { data: lots, isLoading } = useQuery({
    queryKey: ['auctioneer-lots', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lots').select('id, title, photos, starting_bid, current_bid, category, winner_id')
        .eq('auction_id', '00000000-0000-0000-0000-0000000000a1')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!session,
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, base64: true, allowsMultipleSelection: true, selectionLimit: 6,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, base64: a.base64 ?? null }))].slice(0, 6));
    }
  };

  const createLot = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Not logged in');
      if (!title.trim()) throw new Error('Title required');
      if (!startingBid || Number(startingBid) <= 0) throw new Error('Valid starting bid required');

      const photoUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img.base64) continue;
        const path = `${session.user.id}/${Date.now()}-${i}.jpg`;
        const { error } = await supabase.storage.from('lot-photos').upload(path, decode(img.base64), { contentType: 'image/jpeg' });
        if (error) throw error;
        const { data: pub } = supabase.storage.from('lot-photos').getPublicUrl(path);
        photoUrls.push(pub.publicUrl);
      }

      const { data, error } = await supabase.from('lots').insert({
        auction_id: '00000000-0000-0000-0000-0000000000a1',
        title: title.trim(), description: description.trim() || null,
        photos: photoUrls, category,
        starting_bid: Number(startingBid),
        reserve: reserve ? Number(reserve) : null,
        buy_now: buyNow ? Number(buyNow) : null,
        increment: Number(increment) || 500,
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['auctioneer-lots'] });
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      // Reset form
      setTitle(''); setDescription(''); setStartingBid(''); setReserve(''); setBuyNow(''); setIncrement('500'); setImages([]);
      setShowCreate(false);
      if (pickMode && data?.id) {
        setSelected((prev) => { const s = new Set(prev); s.add(data.id); return s; });
      }
      Alert.alert('Lot created', 'Added to your inventory.');
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const openEdit = (lot: any) => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setEditingLot(lot);
    setEditExistingPhotos(lot.photos ?? []);
    setEditImages([]);
    setEditTitle(lot.title ?? '');
    setEditDescription(lot.description ?? '');
    setEditCategory(lot.category ?? CATEGORIES[0]);
    setEditStartingBid(String(lot.starting_bid ?? ''));
    setEditReserve(lot.reserve ? String(lot.reserve) : '');
    setEditBuyNow(lot.buy_now ? String(lot.buy_now) : '');
    setEditIncrement(String(lot.increment ?? 500));
  };

  const pickEditImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, base64: true, allowsMultipleSelection: true, selectionLimit: 6,
    });
    if (!result.canceled) {
      setEditImages((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, base64: a.base64 ?? null }))].slice(0, 6 - editExistingPhotos.length));
    }
  };

  const updateLot = useMutation({
    mutationFn: async () => {
      if (!session || !editingLot) throw new Error('Not logged in');
      if (!editTitle.trim()) throw new Error('Title required');

      const newPhotoUrls: string[] = [];
      for (let i = 0; i < editImages.length; i++) {
        const img = editImages[i];
        if (!img.base64) continue;
        const path = `${session.user.id}/${Date.now()}-${i}.jpg`;
        const { error } = await supabase.storage.from('lot-photos').upload(path, decode(img.base64), { contentType: 'image/jpeg' });
        if (error) throw error;
        const { data: pub } = supabase.storage.from('lot-photos').getPublicUrl(path);
        newPhotoUrls.push(pub.publicUrl);
      }

      const allPhotos = [...editExistingPhotos, ...newPhotoUrls];
      const { error } = await supabase.from('lots').update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        photos: allPhotos,
        category: editCategory,
        starting_bid: Number(editStartingBid),
        reserve: editReserve ? Number(editReserve) : null,
        buy_now: editBuyNow ? Number(editBuyNow) : null,
        increment: Number(editIncrement) || 500,
      }).eq('id', editingLot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctioneer-lots'] });
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      setEditingLot(null);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const deleteLot = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('lots').delete().eq('id', id).select('id');
      if (error) throw new Error(error.message + ' (code: ' + error.code + ')');
      if (!data || data.length === 0) throw new Error('Permission denied — RLS policy blocked the delete. Make sure you are logged in as an auctioneer.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctioneer-lots'] });
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      Alert.alert('Deleted', 'Lot removed.');
    },
    onError: (e: any) => Alert.alert('Delete failed', e.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const confirmPick = () => {
    if (selected.size === 0) { Alert.alert('Select at least one lot'); return; }
    router.back();
    // Pass selected ids back via global — simple approach
    (global as any).__pickedLotIds = Array.from(selected);
    (global as any).__pickedLots = (lots ?? []).filter((l) => selected.has(l.id));
  };

  const inputStyle = [s.input, { backgroundColor: input, borderColor: border, color: ink }];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      <Stack.Screen options={{ headerShown: true, title: pickMode ? 'Select Lots' : 'Manage Lots', headerStyle: { backgroundColor: bg }, headerTintColor: ink }} />

      {pickMode && selected.size > 0 && (
        <Pressable onPress={confirmPick} style={[s.confirmBar, { backgroundColor: Colors.primary }]}>
          <Text style={s.confirmTxt}>{selected.size} lot{selected.size > 1 ? 's' : ''} selected — Confirm</Text>
        </Pressable>
      )}

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Create new lot toggle */}
        <Pressable onPress={() => setShowCreate(!showCreate)}
          style={[s.createToggle, { backgroundColor: showCreate ? Colors.primary : card, borderColor: showCreate ? Colors.primary : border }]}>
          <Text style={{ color: showCreate ? '#fff' : ink, fontWeight: '700', fontSize: 15 }}>
            {showCreate ? '✕ Cancel New Lot' : '+ Create New Lot'}
          </Text>
        </Pressable>

        {showCreate && (
          <View style={[s.createForm, { backgroundColor: card, borderColor: border }]}>
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

            <Text style={[s.label, { color: muted }]}>Title *</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="e.g. 2018 Toyota Hilux" placeholderTextColor="#9CA3AF" style={[inputStyle, s.mb]} />

            <Text style={[s.label, { color: muted }]}>Description</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Condition, km, history..." placeholderTextColor="#9CA3AF" multiline numberOfLines={3} textAlignVertical="top" style={[inputStyle, s.mb, { height: 80 }]} />

            <Text style={[s.label, { color: muted }]}>Category</Text>
            <View style={[s.chipRow, s.mb]}>
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <Pressable key={cat} onPress={() => setCategory(cat)}
                    style={[s.chip, { borderColor: active ? Colors.primary : border, backgroundColor: active ? Colors.primary : 'transparent' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : ink }}>{cat}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Starting Bid (R) *</Text>
                <TextInput value={startingBid} onChangeText={setStartingBid} placeholder="5000" placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle, s.mb]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Increment (R)</Text>
                <TextInput value={increment} onChangeText={setIncrement} placeholder="500" placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle, s.mb]} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Reserve (R)</Text>
                <TextInput value={reserve} onChangeText={setReserve} placeholder="Optional" placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle, s.mb]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Buy Now (R)</Text>
                <TextInput value={buyNow} onChangeText={setBuyNow} placeholder="Optional" placeholderTextColor="#9CA3AF" keyboardType="numeric" style={[inputStyle, s.mb]} />
              </View>
            </View>

            <Pressable onPress={() => createLot.mutate()} disabled={createLot.isPending}
              style={[s.submitBtn, { opacity: createLot.isPending ? 0.7 : 1 }]}>
              {createLot.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnTxt}>Save Lot</Text>}
            </Pressable>
          </View>
        )}

        {/* Existing lots */}
        <Text style={[s.sectionTitle, { color: ink }]}>
          {pickMode ? 'Select lots for the live session:' : 'Your Lots'}
        </Text>

        {isLoading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />}

        {editingLot && (
          <View style={[s.createForm, { backgroundColor: card, borderColor: Colors.primary }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: ink, fontWeight: '700', fontSize: 15 }}>✏️ Edit Lot</Text>
              <Pressable onPress={() => setEditingLot(null)}>
                <Text style={{ color: muted, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>

            <Text style={[s.label, { color: muted }]}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {editExistingPhotos.map((uri, i) => (
                  <View key={`ex-${i}`}>
                    <Image source={{ uri }} style={[s.thumb, { borderColor: border }]} />
                    <Pressable
                      onPress={() => setEditExistingPhotos((p) => p.filter((_, idx) => idx !== i))}
                      style={s.removePhotoBtn}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                {editImages.map((img, i) => (
                  <View key={`new-${i}`}>
                    <Image source={{ uri: img.uri }} style={[s.thumb, { borderColor: Colors.primary }]} />
                    <Pressable
                      onPress={() => setEditImages((p) => p.filter((_, idx) => idx !== i))}
                      style={s.removePhotoBtn}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                {(editExistingPhotos.length + editImages.length) < 6 && (
                  <Pressable onPress={pickEditImage} style={[s.addThumb, { borderColor: border }]}>
                    <Text style={{ fontSize: 28, color: muted }}>+</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>

            <Text style={[s.label, { color: muted }]}>Title *</Text>
            <TextInput value={editTitle} onChangeText={setEditTitle} placeholderTextColor="#9CA3AF" style={[inputStyle, s.mb]} />

            <Text style={[s.label, { color: muted }]}>Description</Text>
            <TextInput value={editDescription} onChangeText={setEditDescription} placeholderTextColor="#9CA3AF" multiline numberOfLines={3} textAlignVertical="top" style={[inputStyle, s.mb, { height: 80 }]} />

            <Text style={[s.label, { color: muted }]}>Category</Text>
            <View style={[s.chipRow, s.mb]}>
              {CATEGORIES.map((cat) => {
                const active = editCategory === cat;
                return (
                  <Pressable key={cat} onPress={() => setEditCategory(cat)}
                    style={[s.chip, { borderColor: active ? Colors.primary : border, backgroundColor: active ? Colors.primary : 'transparent' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : ink }}>{cat}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Starting Bid (R)</Text>
                <TextInput value={editStartingBid} onChangeText={setEditStartingBid} keyboardType="numeric" placeholderTextColor="#9CA3AF" style={[inputStyle, s.mb]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Increment (R)</Text>
                <TextInput value={editIncrement} onChangeText={setEditIncrement} keyboardType="numeric" placeholderTextColor="#9CA3AF" style={[inputStyle, s.mb]} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Reserve (R)</Text>
                <TextInput value={editReserve} onChangeText={setEditReserve} placeholder="Optional" keyboardType="numeric" placeholderTextColor="#9CA3AF" style={[inputStyle, s.mb]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Buy Now (R)</Text>
                <TextInput value={editBuyNow} onChangeText={setEditBuyNow} placeholder="Optional" keyboardType="numeric" placeholderTextColor="#9CA3AF" style={[inputStyle, s.mb]} />
              </View>
            </View>

            <Pressable onPress={() => updateLot.mutate()} disabled={updateLot.isPending}
              style={[s.submitBtn, { opacity: updateLot.isPending ? 0.7 : 1 }]}>
              {updateLot.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnTxt}>💾 Save Changes</Text>}
            </Pressable>
          </View>
        )}

        {(lots ?? []).map((lot) => {
          const isSelected = selected.has(lot.id);
          const RowEl = pickMode ? Pressable : View;
          return (
            <RowEl key={lot.id} {...(pickMode ? { onPress: () => toggleSelect(lot.id) } : {})}
              style={[s.lotRow, { backgroundColor: card, borderColor: isSelected ? Colors.primary : border }]}>
              <Image source={{ uri: lot.photos?.[0] || 'https://picsum.photos/80/80' }} style={s.lotThumb} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.lotTitle, { color: ink }]} numberOfLines={1}>{lot.title}</Text>
                <Text style={{ color: muted, fontSize: 12 }}>{lot.category}</Text>
                <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 14, marginTop: 2 }}>
                  {formatZAR(lot.current_bid ?? lot.starting_bid)}
                </Text>
              </View>
              {pickMode ? (
                <View style={[s.checkbox, { borderColor: isSelected ? Colors.primary : border, backgroundColor: isSelected ? Colors.primary : 'transparent' }]}>
                  {isSelected && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
                  <TouchableOpacity onPress={() => openEdit(lot)} style={s.iconBtn} activeOpacity={0.6}>
                    <Text style={{ fontSize: 18 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteLot.mutate(lot.id)} style={[s.iconBtn, s.iconBtnRed]} activeOpacity={0.6}>
                    <Text style={{ fontSize: 18 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </RowEl>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  confirmBar: { padding: 14, alignItems: 'center' },
  confirmTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  createToggle: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  createForm: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  lotRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, padding: 10, marginBottom: 10 },
  lotThumb: { width: 60, height: 60, borderRadius: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  iconBtnRed: { backgroundColor: '#FEE2E2' },
  lotTitle: { fontSize: 14, fontWeight: '600' },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  mb: { marginBottom: 12 },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10, borderWidth: 1 },
  addThumb: { width: 72, height: 72, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  removePhotoBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
