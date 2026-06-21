import { Redirect, Link } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useAuthStore } from '../lib/auth-store';

export default function Welcome() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (session && profile) return <Redirect href="/(tabs)" />;

  return (
    <View style={s.root}>
      <View style={s.top}>
        <Image source={require('../assets/icon.png')} style={s.logo} resizeMode="cover" />
        <Text style={s.title}>West Coast Pickers</Text>
        <Text style={s.sub}>South Africa's premier live{'\n'}auction marketplace 🇿🇦</Text>
      </View>
      <View style={s.btns}>
        <Link href="/(auth)/role" asChild>
          <Pressable style={[s.btn, { backgroundColor: '#fff' }]}>
            <Text style={[s.btnTxt, { color: '#0B5FFF' }]}>Get Started</Text>
          </Pressable>
        </Link>
        <Link href="/(auth)/login" asChild>
          <Pressable style={[s.btn, { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' }]}>
            <Text style={[s.btnTxt, { color: '#fff' }]}>I already have an account</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)" asChild>
          <Pressable style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textDecorationLine: 'underline' }}>
              Continue as guest
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B5FFF', paddingHorizontal: 32 },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 100, height: 100, borderRadius: 22, marginBottom: 20 },
  title: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  sub: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 8, lineHeight: 24 },
  btns: { paddingBottom: 52, gap: 12 },
  btn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnTxt: { fontSize: 16, fontWeight: '700' },
});
