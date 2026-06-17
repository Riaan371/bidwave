import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { router, Link } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/auth-store';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

    if (!existing && meta?.full_name) {
      await supabase.from('users').insert({
        id: data.user.id,
        role: meta.role ?? 'bidder',
        full_name: meta.full_name,
        email: data.user.email,
        phone: meta.phone,
        id_number_hash: meta.id_number,
        bank_token: JSON.stringify({ bankName: meta.bank_name, accountNumber: meta.account_number, branchCode: meta.branch_code }),
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
      <Text style={s.heading}>Log in</Text>
      <Text style={s.sub}>Welcome back to BidWave</Text>

      {error ? <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View> : null}

      <Text style={s.label}>Email address</Text>
      <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="jane@example.com"
        placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />

      <Text style={s.label}>Password</Text>
      <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="••••••••"
        placeholderTextColor="#9ca3af" secureTextEntry autoCapitalize="none" />

      <Pressable disabled={loading} onPress={submit} style={[s.btn, { opacity: loading ? 0.8 : 1 }]}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Log in</Text>}
      </Pressable>

      <Link href="/(auth)/role" asChild>
        <Pressable style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ color: '#0B5FFF', fontSize: 14 }}>Don't have an account? Create one</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, backgroundColor: '#fff', padding: 28, paddingTop: 16 },
  heading: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  sub: { fontSize: 15, color: 'rgba(15,23,42,0.5)', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(15,23,42,0.6)', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#0F172A', marginBottom: 16, backgroundColor: '#f9fafb' },
  btn: { backgroundColor: '#0B5FFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorTxt: { color: '#dc2626', fontSize: 13 },
});
