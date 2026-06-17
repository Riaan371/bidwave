import { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';

function format(ms: number) {
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${sec}s left`;
  return `${sec}s left`;
}

export default function CountdownTimer({ endAt, style }: { endAt: string | null | undefined; style?: object }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!endAt) return null;
  const remaining = new Date(endAt).getTime() - now;
  const urgent = remaining > 0 && remaining < 3600000;
  return (
    <Text style={[s.txt, urgent ? s.urgent : s.normal, style]}>
      {remaining <= 0 ? 'Ended' : `⏱ ${format(remaining)}`}
    </Text>
  );
}

const s = StyleSheet.create({
  txt: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  normal: { color: 'rgba(15,23,42,0.5)' },
  urgent: { color: '#DC2626' },
});
