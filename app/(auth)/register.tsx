import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Register() {
  const { role } = useLocalSearchParams<{ role: 'bidder' | 'auctioneer' }>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!fullName || !email || !password || !idNumber) { setError('Please fill in all required fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(''); setLoading(true);

    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { data: { role: role ?? 'bidder', full_name: fullName, phone, id_number: idNumber, bank_name: bankName, account_number: accountNumber, branch_code: branchCode } },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  if (sent) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>📧</Text>
        <Text style={s.heading}>Check your email</Text>
        <Text style={s.sub}>We sent a confirmation link to{'\n'}<Text style={{ color: '#0B5FFF' }}>{email}</Text>{'\n'}Tap it to verify, then log in.</Text>
        <Pressable onPress={() => router.replace('/(auth)/login')} style={[s.btn, { marginTop: 28 }]}>
          <Text style={s.btnTxt}>Go to login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: '#fff' }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>Create your account</Text>
      <Text style={s.sub}>Required for identity verification and secure payments under POPIA.</Text>

      {error ? <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View> : null}

      <F label="Full name *" value={fullName} onChange={setFullName} placeholder="Jane Dlamini" />
      <F label="Email address *" value={email} onChange={setEmail} placeholder="jane@example.com" keyboard="email-address" />
      <F label="Password * (min 6 chars)" value={password} onChange={setPassword} placeholder="••••••••" secure />
      <F label="Mobile number" value={phone} onChange={setPhone} placeholder="082 123 4567" keyboard="phone-pad" />
      <F label="SA ID or Passport number *" value={idNumber} onChange={setIdNumber} placeholder="8501015009087" />

      <Text style={[s.heading, { fontSize: 18, marginTop: 8, marginBottom: 12 }]}>Banking details</Text>
      <F label="Bank name" value={bankName} onChange={setBankName} placeholder="FNB" />
      <F label="Account number" value={accountNumber} onChange={setAccountNumber} placeholder="62123456789" keyboard="number-pad" />
      <F label="Branch code" value={branchCode} onChange={setBranchCode} placeholder="250655" keyboard="number-pad" />

      <Pressable disabled={loading} onPress={submit} style={[s.btn, { opacity: loading ? 0.8 : 1 }]}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Create account</Text>}
      </Pressable>
      <Text style={s.legal}>By continuing you agree to BidWave's Terms & Conditions and Privacy Policy.</Text>
    </ScrollView>
  );
}

function F({ label, value, onChange, placeholder, keyboard, secure }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: any; secure?: boolean }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9ca3af" keyboardType={keyboard ?? 'default'} secureTextEntry={secure} autoCapitalize="none" />
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 28, paddingTop: 8, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32 },
  heading: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  sub: { fontSize: 14, color: 'rgba(15,23,42,0.5)', marginBottom: 22, lineHeight: 21, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(15,23,42,0.6)', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', backgroundColor: '#f9fafb' },
  btn: { backgroundColor: '#0B5FFF', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorTxt: { color: '#dc2626', fontSize: 13 },
  legal: { fontSize: 11, color: 'rgba(15,23,42,0.35)', textAlign: 'center', marginTop: 16 },
});
