import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView, Image } from 'react-native';
import { router, Link } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';
import { Colors } from '../../lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const loadProfile = useAuthStore((s) => s.loadProfile);

  const submit = async () => {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError(''); setLoading(true);

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setLoading(false);
      setError(err.message.toLowerCase().includes('confirm')
        ? 'Please confirm your email first — check your inbox.'
        : err.message);
      return;
    }

    setSession(data.session);
    const meta = data.user.user_metadata as Record<string, string> | undefined;
    const { data: existing } = await supabase.from('users').select('id').eq('id', data.user.id).maybeSingle();

    if (!existing) {
      await supabase.from('users').insert({
        id: data.user.id,
        role: meta?.role ?? 'bidder',
        full_name: meta?.full_name ?? data.user.email?.split('@')[0] ?? 'User',
        email: data.user.email,
        phone: meta?.phone,
        id_number_hash: meta?.id_number,
        bank_token: meta ? JSON.stringify({ bankName: meta.bank_name, accountNumber: meta.account_number, branchCode: meta.branch_code }) : null,
        kyc_status: 'pending',
      });
    }

    await loadProfile();
    setLoading(false);
    const profile = useAuthStore.getState().profile;
    if (profile?.role === 'auctioneer' && profile.kyc_status === 'pending') {
      router.replace('/(auth)/pending');
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <ScrollView contentContainerStyle={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.logoWrap}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.brand}>West Coast Pickers</Text>
        <Text style={s.brandSub}>South Africa's Live Auction Marketplace</Text>
      </View>

      <View style={s.card}>
        <Text style={s.heading}>Welcome back</Text>
        <Text style={s.sub}>Sign in to your account</Text>

        {error ? <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View> : null}

        <Text style={s.label}>Email address</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="jane@example.com"
          placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />

        <Text style={s.label}>Password</Text>
        <View style={s.passwordRow}>
          <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={password} onChangeText={setPassword}
            placeholder="••••••••" placeholderTextColor="#9ca3af" secureTextEntry={!showPassword} autoCapitalize="none" />
          <Pressable onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
            <Text style={s.eyeTxt}>{showPassword ? '🙈' : '👁'}</Text>
          </Pressable>
        </View>

        <Pressable disabled={loading} onPress={submit} style={[s.btn, { opacity: loading ? 0.8 : 1 }]}>
          {loading ? <ActivityIndicator color={Colors.navy} /> : <Text style={s.btnTxt}>Sign In</Text>}
        </Pressable>

        <Link href="/(auth)/role" asChild>
          <Pressable style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: Colors.gold, fontSize: 14, fontWeight: '600' }}>Don't have an account? Create one</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, backgroundColor: Colors.navy, padding: 24, paddingTop: 48 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 90, height: 90, marginBottom: 12 },
  brand: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  brandSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.navy, marginBottom: 4 },
  sub: { fontSize: 14, color: 'rgba(15,23,42,0.5)', marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '700', color: 'rgba(15,23,42,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#0F172A', marginBottom: 14, backgroundColor: '#F8F7F4' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F8F7F4', marginBottom: 14 },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 13 },
  eyeTxt: { fontSize: 16 },
  btn: { backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  btnTxt: { color: Colors.navy, fontWeight: '800', fontSize: 16 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorTxt: { color: '#dc2626', fontSize: 13 },
});
