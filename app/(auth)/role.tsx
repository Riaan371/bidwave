import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function ChooseRole() {
  return (
    <View style={s.root}>
      <Text style={s.heading}>Join BidWave</Text>
      <Text style={s.sub}>Create a free bidder account to start placing bids on live and timed auctions.</Text>

      <View style={[s.card, s.selectedCard]}>
        <Text style={s.cardTitle}>🙋 Bidder</Text>
        <Text style={s.cardSub}>Browse auctions, place bids, and pay securely for items you win.</Text>
      </View>

      <View style={[s.card, s.dimCard]}>
        <Text style={s.cardTitle}>🔨 Auctioneer</Text>
        <Text style={s.cardSub}>Auctioneer accounts are set up by the BidWave team. Contact us to get started.</Text>
      </View>

      <View style={{ flex: 1 }} />

      <Pressable onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'bidder' } })} style={s.btn}>
        <Text style={s.btnTxt}>Continue as Bidder</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={{ alignItems: 'center', marginTop: 16, paddingBottom: 16 }}>
        <Text style={{ color: 'rgba(15,23,42,0.4)', fontSize: 14 }}>Back</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', padding: 28, paddingTop: 16 },
  heading: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  sub: { fontSize: 15, color: 'rgba(15,23,42,0.5)', marginBottom: 28, lineHeight: 22 },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 12 },
  selectedCard: { borderColor: '#0B5FFF', backgroundColor: 'rgba(11,95,255,0.04)' },
  dimCard: { borderColor: '#e5e7eb', opacity: 0.5 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  cardSub: { fontSize: 14, color: 'rgba(15,23,42,0.55)', lineHeight: 20 },
  btn: { backgroundColor: '#0B5FFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
