import { Redirect, Link } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Image, ImageBackground } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/auth-store';
import { Colors } from '../lib/theme';

export default function Welcome() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandalone = typeof window !== 'undefined' && (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) { setShowIOSGuide(true); return; }
    if (!installPrompt) { setShowIOSGuide(true); return; }
    installPrompt.prompt();
    await installPrompt.userChoice;
  };

  if (session && profile) return <Redirect href="/(tabs)" />;

  return (
    <View style={s.root}>
      {/* Top: logo + branding */}
      <View style={s.top}>
        <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.title}>West Coast Picker</Text>
        <Text style={s.tagline}>South Africa's Live Auction Marketplace</Text>
        <View style={s.divider} />
        <Text style={s.sub}>Bid live on vehicles, livestock, plant & equipment, collectibles and more — from anywhere in South Africa.</Text>

        {!isInStandalone && (
          <Pressable onPress={handleInstall} style={s.installBtn}>
            <Text style={s.installBtnTxt}>📲 Install App</Text>
          </Pressable>
        )}
      </View>

      {showIOSGuide && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 999, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.navy, marginBottom: 8 }}>Install on Mobile</Text>
            <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
              iPhone/iPad: Tap Share → "Add to Home Screen"{'\n'}
              Android (Chrome): Tap the 3-dot menu → "Add to Home screen"
            </Text>
            <Pressable onPress={() => setShowIOSGuide(false)} style={{ backgroundColor: Colors.navy, borderRadius: 10, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Got it</Text>
            </Pressable>
          </View>
        </View>
      )}

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
  installBtn: { marginTop: 20, borderWidth: 1.5, borderColor: Colors.gold, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  installBtnTxt: { color: Colors.gold, fontWeight: '700', fontSize: 13 },
  btns: { paddingBottom: 48, gap: 12 },
  btnPrimary: { backgroundColor: Colors.gold, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  btnPrimaryTxt: { color: Colors.navy, fontWeight: '800', fontSize: 16 },
  btnSecondary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(196,154,34,0.5)' },
  btnSecondaryTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  guestTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});
