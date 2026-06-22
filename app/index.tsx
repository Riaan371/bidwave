import { Redirect, Link } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Image, ImageBackground } from 'react-native';
import { useAuthStore } from '../lib/auth-store';
import { Colors } from '../lib/theme';

export default function Welcome() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (session && profile) return <Redirect href="/(tabs)" />;

  return (
    <View style={s.root}>
      {/* Top: logo + branding */}
      <View style={s.top}>
        <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.title}>West Coast Pickers</Text>
        <Text style={s.tagline}>South Africa's Live Auction Marketplace</Text>
        <View style={s.divider} />
        <Text style={s.sub}>Bid live on vehicles, livestock, plant & equipment, collectibles and more — from anywhere in South Africa.</Text>
      </View>

      {/* Bottom: CTAs */}
      <View style={s.btns}>
        <Link href="/(auth)/role" asChild>
          <Pressable style={s.btnPrimary}>
            <Text style={s.btnPrimaryTxt}>Get Started — Register Free</Text>
          </Pressable>
        </Link>
        <Link href="/(auth)/login" asChild>
          <Pressable style={s.btnSecondary}>
            <Text style={s.btnSecondaryTxt}>I Already Have an Account</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)" asChild>
          <Pressable style={{ alignItems: 'center', marginTop: 16, paddingBottom: 8 }}>
            <Text style={s.guestTxt}>Continue as Guest →</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.navy, paddingHorizontal: 28 },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 0.2, textAlign: 'center' },
  tagline: { fontSize: 13, color: Colors.gold, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6, textAlign: 'center' },
  divider: { width: 48, height: 2, backgroundColor: Colors.gold, borderRadius: 2, marginVertical: 20 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  btns: { paddingBottom: 48, gap: 12 },
  btnPrimary: { backgroundColor: Colors.gold, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  btnPrimaryTxt: { color: Colors.navy, fontWeight: '800', fontSize: 16 },
  btnSecondary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(196,154,34,0.5)' },
  btnSecondaryTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  guestTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});
