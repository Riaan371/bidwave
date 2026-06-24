import { View, Text, Pressable, Switch, ScrollView, StyleSheet, Alert, TextInput, Platform, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuthStore } from '../../lib/auth-store';
import { useThemeStore } from '../../lib/theme-store';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../lib/theme';

function confirmAsync(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      resolve(window.confirm(`${title}\n\n${message}`));
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ]);
    }
  });
}

function ActiveLotsPanel({ userId, ink, muted, card, border }: { userId: string; ink: string; muted: string; card: string; border: string }) {
  const [expanded, setExpanded] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data: lots, isLoading } = useQuery({
    queryKey: ['profile-lots', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lots')
        .select('id, title, photos, starting_bid, current_bid, category, auction_id, auctions(title, status, type, end_at, closed_at)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['profile-lots'] });
    queryClient.invalidateQueries({ queryKey: ['auctioneer-lots'] });
    queryClient.invalidateQueries({ queryKey: ['auction-events'] });
  };

  const deleteLot = async (lotId: string, title: string) => {
    const ok = await confirmAsync('Delete Lot', `Are you sure you want to delete "${title}"? This cannot be undone.`);
    if (!ok) return;
    const { error } = await supabase.from('lots').delete().eq('id', lotId);
    if (error) { Alert.alert('Error', error.message); return; }
    refreshAll();
  };

  const deleteAuctionGroup = async (auctionId: string, title: string) => {
    const ok = await confirmAsync('Delete Auction', `Delete "${title}"? Lots will be returned to your inventory (unpublished), and the auction will be removed.`);
    if (!ok) return;
    await supabase.from('lots').update({ auction_id: null }).eq('auction_id', auctionId);
    await supabase.from('live_sessions').delete().eq('auction_id', auctionId);
    const { error } = await supabase.from('auctions').delete().eq('id', auctionId);
    if (error) { Alert.alert('Error', error.message); return; }
    refreshAll();
  };

  const inAuction = (lots ?? []).filter((l: any) => !!l.auction_id);
  const inventory = (lots ?? []).filter((l: any) => !l.auction_id);

  // Group by auction
  const groups: Record<string, { title: string; status: string; type: string; closedAt: string | null; lots: any[] }> = {};
  for (const lot of inAuction) {
    const aid = lot.auction_id;
    const auction = (lot as any).auctions;
    if (!groups[aid]) groups[aid] = {
      title: auction?.title ?? 'Auction',
      status: auction?.status ?? '',
      type: auction?.type ?? '',
      closedAt: auction?.closed_at ?? auction?.end_at ?? null,
      lots: [],
    };
    groups[aid].lots.push(lot);
  }

  const formatClosedAt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  const closedStatuses = ['closed', 'cancelled'];
  const activeGroupEntries = Object.entries(groups).filter(([, g]) => !closedStatuses.includes(g.status));
  const closedGroupEntries = Object.entries(groups).filter(([, g]) => closedStatuses.includes(g.status));
  const activeCount = activeGroupEntries.reduce((n, [, g]) => n + g.lots.length, 0) + inventory.length;
  const completedCount = closedGroupEntries.reduce((n, [, g]) => n + g.lots.length, 0);

  if (!lots || lots.length === 0) return null;

  return (
    <View style={{ marginBottom: 10 }}>
      <Pressable onPress={() => setExpanded(v => !v)}
        style={[s.btn, { backgroundColor: Colors.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[s.btnText, { color: '#fff' }]}>🔨 My Lots ({activeCount})</Text>
        <Text style={{ color: '#fff', fontSize: 13, marginLeft: 8 }}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={[{ borderWidth: 1, borderRadius: 14, marginTop: 8, padding: 12 }, { borderColor: border, backgroundColor: card }]}>
          {isLoading && <ActivityIndicator color={Colors.gold} style={{ marginBottom: 12 }} />}

          {activeGroupEntries.map(([aid, group]) => (
            <View key={aid} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: Colors.gold, fontWeight: '700', fontSize: 12, flex: 1 }}>📦 {group.title}</Text>
                <View style={{ backgroundColor: group.status === 'active' ? '#16A34A' : '#6B7280', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{group.status.toUpperCase()}</Text>
                </View>
                <Pressable onPress={() => deleteAuctionGroup(aid, group.title)} style={{ backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '700' }}>🗑 Delete Auction</Text>
                </Pressable>
              </View>
              {group.lots.map((lot: any) => (
                <View key={lot.id} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: border, borderRadius: 10, padding: 8, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  {lot.photos?.[0] ? (
                    <Image source={{ uri: lot.photos[0] }} style={{ width: 46, height: 46, borderRadius: 8 }} />
                  ) : (
                    <View style={{ width: 46, height: 46, borderRadius: 8, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>📷</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: ink, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{lot.title}</Text>
                    <Text style={{ color: muted, fontSize: 11 }}>
                      R{((lot.current_bid ?? lot.starting_bid) ?? 0).toLocaleString('en-ZA')} · {lot.category ?? '—'}
                    </Text>
                  </View>
                  <Pressable onPress={() => router.push('/manage-lots')}
                    style={{ backgroundColor: Colors.navy, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✏️ Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteLot(lot.id, lot.title)}
                    style={{ backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6 }}>
                    <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>🗑</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))}

          {inventory.length > 0 && (
            <View>
              <Text style={{ color: muted, fontWeight: '700', fontSize: 12, marginBottom: 6 }}>🗃 Inventory (unpublished)</Text>
              {inventory.map((lot: any) => (
                <View key={lot.id} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: border, borderRadius: 10, padding: 8, marginBottom: 6 }}>
                  {lot.photos?.[0] ? (
                    <Image source={{ uri: lot.photos[0] }} style={{ width: 46, height: 46, borderRadius: 8 }} />
                  ) : (
                    <View style={{ width: 46, height: 46, borderRadius: 8, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>📷</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: ink, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{lot.title}</Text>
                    <Text style={{ color: muted, fontSize: 11 }}>
                      R{((lot.current_bid ?? lot.starting_bid) ?? 0).toLocaleString('en-ZA')} · {lot.category ?? '—'}
                    </Text>
                  </View>
                  <Pressable onPress={() => router.push('/manage-lots')}
                    style={{ backgroundColor: Colors.navy, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✏️ Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteLot(lot.id, lot.title)}
                    style={{ backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6 }}>
                    <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>🗑</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable onPress={() => router.push('/manage-lots')}
            style={{ marginTop: 4, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.gold, alignItems: 'center' }}>
            <Text style={{ color: Colors.gold, fontWeight: '700', fontSize: 13 }}>Open Manage Lots →</Text>
          </Pressable>
        </View>
      )}

      {closedGroupEntries.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Pressable onPress={() => setCompletedExpanded(v => !v)}
            style={[s.btn, { backgroundColor: '#6B7280', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[s.btnText, { color: '#fff' }]}>✅ Completed Auctions ({completedCount})</Text>
            <Text style={{ color: '#fff', fontSize: 13, marginLeft: 8 }}>{completedExpanded ? '▲' : '▼'}</Text>
          </Pressable>

          {completedExpanded && (
            <View style={[{ borderWidth: 1, borderRadius: 14, marginTop: 8, padding: 12 }, { borderColor: border, backgroundColor: card }]}>
              {closedGroupEntries.map(([aid, group]) => (
                <View key={aid} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={{ color: Colors.gold, fontWeight: '700', fontSize: 12, flex: 1 }}>📦 {group.title}</Text>
                    <View style={{ backgroundColor: '#6B7280', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{group.status.toUpperCase()}</Text>
                    </View>
                    <Pressable onPress={() => deleteAuctionGroup(aid, group.title)} style={{ backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '700' }}>🗑 Delete Auction</Text>
                    </Pressable>
                  </View>
                  <Text style={{ color: muted, fontSize: 11, marginBottom: 6 }}>
                    {group.type === 'live' ? '🔴 Live' : group.type === 'timed' ? '⏱ Timed' : '—'}
                    {formatClosedAt(group.closedAt) ? ` · Closed ${formatClosedAt(group.closedAt)}` : ''}
                  </Text>
                  {group.lots.map((lot: any) => (
                    <View key={lot.id} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: border, borderRadius: 10, padding: 8, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                      {lot.photos?.[0] ? (
                        <Image source={{ uri: lot.photos[0] }} style={{ width: 46, height: 46, borderRadius: 8 }} />
                      ) : (
                        <View style={{ width: 46, height: 46, borderRadius: 8, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 20 }}>📷</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: ink, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{lot.title}</Text>
                        <Text style={{ color: muted, fontSize: 11 }}>
                          R{((lot.current_bid ?? lot.starting_bid) ?? 0).toLocaleString('en-ZA')} · {lot.category ?? '—'}
                        </Text>
                      </View>
                      <Pressable onPress={() => router.push('/manage-lots')}
                        style={{ backgroundColor: Colors.navy, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✏️ Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteLot(lot.id, lot.title)}
                        style={{ backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6 }}>
                        <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>🗑</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ExportReportMenuItem({ ink, muted, card, border }: { ink: string; muted: string; card: string; border: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ marginBottom: 10 }}>
      <Pressable onPress={() => setExpanded(v => !v)}
        style={[s.btn, { backgroundColor: '#16A34A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[s.btnText, { color: '#fff' }]}>📊 Export Sales Report</Text>
        <Text style={{ color: '#fff', fontSize: 13, marginLeft: 8 }}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>
      {expanded && (
        <View style={{ marginTop: 8 }}>
          <ExportReport ink={ink} muted={muted} card={card} border={border} />
        </View>
      )}
    </View>
  );
}

function ExportReport({ ink, muted, card, border }: { ink: string; muted: string; card: string; border: string }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);

  const exportCSV = async () => {
    if (!fromDate || !toDate) { Alert.alert('Select both dates', 'Enter a from and to date (DD/MM/YYYY)'); return; }
    const parseDate = (d: string) => {
      const [day, month, year] = d.split('/');
      return new Date(Number(year), Number(month) - 1, Number(day));
    };
    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    to.setHours(23, 59, 59);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) { Alert.alert('Invalid date', 'Use DD/MM/YYYY format'); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('sold_at, sale_price, winner_name, winner_id, lot_id, lots(title, category)')
        .gte('sold_at', from.toISOString())
        .lte('sold_at', to.toISOString())
        .order('sold_at');

      if (error) throw error;
      if (!data || data.length === 0) { Alert.alert('No sales', 'No sales found for this date range.'); setLoading(false); return; }

      const rows = [
        ['Date & Time', 'Lot Title', 'Category', 'Winner Name', 'Sale Price (ZAR)'],
        ...(data as any[]).map((s) => [
          new Date(s.sold_at).toLocaleString('en-ZA'),
          s.lots?.title ?? s.lot_id,
          s.lots?.category ?? '',
          s.winner_name ?? 'Unknown',
          s.sale_price,
        ]),
      ];

      const total = (data as any[]).reduce((sum, s) => sum + Number(s.sale_price), 0);
      rows.push(['', '', '', 'TOTAL', total]);

      const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const filename = `WCP_Sales_${fromDate.replace(/\//g, '-')}_to_${toDate.replace(/\//g, '-')}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('Export ready', 'Excel export is available on the web version.');
      }
    } catch (e: any) {
      Alert.alert('Export failed', e.message);
    }
    setLoading(false);
  };

  return (
    <View style={[{ borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 }, { borderColor: border, backgroundColor: card }]}>
      <Text style={{ color: ink, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>📊 Export Sales Report</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: muted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>FROM (DD/MM/YYYY)</Text>
          <TextInput value={fromDate} onChangeText={setFromDate} placeholder="01/06/2026" placeholderTextColor="#9CA3AF"
            style={{ borderWidth: 1, borderColor: border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: ink, fontSize: 13 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: muted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>TO (DD/MM/YYYY)</Text>
          <TextInput value={toDate} onChangeText={setToDate} placeholder="30/06/2026" placeholderTextColor="#9CA3AF"
            style={{ borderWidth: 1, borderColor: border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: ink, fontSize: 13 }} />
        </View>
      </View>
      <Pressable onPress={exportCSV} disabled={loading}
        style={{ backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 13, alignItems: 'center', opacity: loading ? 0.7 : 1 }}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>⬇ Download CSV</Text>}
      </Pressable>
    </View>
  );
}

function SessionLotNames({ lotIds, ink, muted }: { lotIds: string[]; ink: string; muted: string }) {
  const { data: lots } = useQuery({
    queryKey: ['profile-session-lots', lotIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase.from('lots').select('id, title').in('id', lotIds);
      return data ?? [];
    },
    enabled: lotIds.length > 0,
  });
  if (!lots?.length) return null;
  return (
    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.15)' }}>
      <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lots on the block</Text>
      {lots.map((l, i) => (
        <Text key={l.id} style={{ color: ink, fontSize: 12, marginBottom: 2 }}>{i + 1}. {l.title}</Text>
      ))}
    </View>
  );
}

function AuctioneerPanel({ userId, ink, muted, card, border }: { userId: string; ink: string; muted: string; card: string; border: string }) {
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const queryClient = useQueryClient();

  const goLive = async (auctionId: string) => {
    const { error } = await supabase.from('live_sessions').update({ status: 'live' }).eq('auction_id', auctionId);
    if (error) { Alert.alert('Error', error.message); return; }
    await supabase.from('auctions').update({ status: 'active' }).eq('id', auctionId).eq('status', 'scheduled');
    queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    router.push(`/live/${auctionId}`);
  };

  const { data: sessions, refetch } = useQuery({
    queryKey: ['my-sessions', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('id, auction_id, title, status, scheduled_at, lot_ids')
        .eq('auctioneer_id', userId)
        .in('status', ['scheduled', 'live'])
        .order('scheduled_at', { ascending: true });
      return data ?? [];
    },
  });

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from('live_sessions').delete().eq('id', id);
    if (error) { Alert.alert('Error', error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['scheduled-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
    refetch();
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable onPress={() => router.push('/manage-lots')} style={[s.btn, { backgroundColor: Colors.navy, marginBottom: 10 }]}>
        <Text style={[s.btnText, { color: '#fff' }]}>📦 Manage Lots</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/schedule-live')} style={[s.btn, { backgroundColor: Colors.gold, marginBottom: 12 }]}>
        <Text style={[s.btnText, { color: Colors.navy }]}>🔴 Schedule / Go Live</Text>
      </Pressable>

      <ActiveLotsPanel userId={userId} ink={ink} muted={muted} card={card} border={border} />

      <ExportReportMenuItem ink={ink} muted={muted} card={card} border={border} />

      {sessions && sessions.length > 0 && (
        <View style={{ marginTop: 4 }}>
          <Pressable onPress={() => setSessionsExpanded(v => !v)}
            style={[s.btn, { backgroundColor: Colors.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[s.btnText, { color: Colors.navy }]}>📅 Scheduled Sessions ({sessions.length})</Text>
            <Text style={{ color: Colors.navy, fontSize: 13, marginLeft: 8 }}>{sessionsExpanded ? '▲' : '▼'}</Text>
          </Pressable>

          {sessionsExpanded && (
            <View style={[{ borderWidth: 1, borderRadius: 14, marginTop: 8, padding: 14 }, { borderColor: border, backgroundColor: card }]}>
              {sessions.map((s2) => {
                const dt = s2.scheduled_at ? new Date(s2.scheduled_at) : null;
                const dateStr = dt ? dt.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }) + ' at ' + dt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : 'Live now';
                return (
                  <View key={s2.id} style={{ borderWidth: 1, borderColor: border, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: ink, fontWeight: '700', fontSize: 14 }}>{s2.title ?? 'Untitled'}</Text>
                        <Text style={{ color: Colors.gold, fontSize: 12, fontWeight: '600', marginTop: 2 }}>📅 {dateStr}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
                        <Pressable onPress={() => goLive(s2.auction_id)} style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(22,163,74,0.1)', borderRadius: 8 }}>
                          <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 12 }}>▶ Go Live</Text>
                        </Pressable>
                        <Pressable onPress={() => deleteSession(s2.id)} style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(220,38,38,0.1)', borderRadius: 8 }}>
                          <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                    {s2.lot_ids && s2.lot_ids.length > 0 && (
                      <SessionLotNames lotIds={s2.lot_ids} ink={ink} muted={muted} />
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ScreenNameEditor({ userId, currentName, ink, muted, card, border }: { userId: string; currentName: string | null; ink: string; muted: string; card: string; border: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName ?? '');
  const [saving, setSaving] = useState(false);
  const loadProfile = useAuthStore((s) => s.loadProfile);

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await supabase.from('users').update({ screen_name: value.trim() }).eq('id', userId);
    await loadProfile();
    setSaving(false);
    setEditing(false);
  };

  return (
    <View style={[{ borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 }, { borderColor: border, backgroundColor: card }]}>
      <Text style={{ color: ink, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>🎭 Screen Name</Text>
      <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>This name is shown when you place bids</Text>
      {editing ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput value={value} onChangeText={setValue} placeholder="Enter screen name" placeholderTextColor={muted}
            style={{ flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderColor: border, color: ink, fontSize: 14 }} />
          <Pressable onPress={save} disabled={saving} style={{ backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}>
            {saving ? <ActivityIndicator color={Colors.navy} size="small" /> : <Text style={{ color: Colors.navy, fontWeight: '700' }}>Save</Text>}
          </Pressable>
          <Pressable onPress={() => setEditing(false)}>
            <Text style={{ color: muted, fontSize: 13 }}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: ink, fontSize: 15, fontWeight: '600' }}>{currentName ?? 'Not set'}</Text>
          <Pressable onPress={() => { setValue(currentName ?? ''); setEditing(true); }}
            style={{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderColor: Colors.gold }}>
            <Text style={{ color: Colors.gold, fontSize: 13, fontWeight: '600' }}>Edit</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function Profile() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const dark = theme === 'dark';

  const bg = dark ? '#080E18' : '#F8F7F4';
  const card = dark ? '#0D1B2E' : '#ffffff';
  const border = dark ? '#1B2B4B' : '#E5E7EB';
  const ink = dark ? '#F1F5F9' : '#0F172A';
  const muted = dark ? 'rgba(241,245,249,0.45)' : 'rgba(15,23,42,0.5)';

  const ThemeToggle = (
    <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.cardTitle, { color: ink }]}>Dark mode</Text>
        <Text style={[s.cardSub, { color: muted }]}>Easier on the eyes at night</Text>
      </View>
      <Switch value={dark} onValueChange={toggleTheme} trackColor={{ true: Colors.gold, false: '#d1d5db' }} thumbColor="#fff" />
    </View>
  );

  // ── GUEST VIEW ──
  if (!session || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.navy }}>
        <View style={s.guestRoot}>
          <Image source={require('../../assets/logo.png')} style={s.guestLogo} resizeMode="contain" />
          <Text style={s.guestBrand}>West Coast Pickers</Text>
          <Text style={s.guestTagline}>South Africa's Live Auction Marketplace</Text>

          <View style={s.guestCard}>
            <Text style={s.guestHeading}>Join the Auction</Text>
            <Text style={s.guestSub}>Create an account to place bids, save lots, and track your wins.</Text>
            <Pressable onPress={() => router.push('/(auth)/role')} style={s.guestBtn}>
              <Text style={s.guestBtnTxt}>Create an Account</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(auth)/login')} style={{ alignItems: 'center', marginTop: 14 }}>
              <Text style={{ color: Colors.gold, fontSize: 14, fontWeight: '600' }}>I already have an account</Text>
            </Pressable>
          </View>

          <View style={{ width: '100%', marginTop: 20 }}>{ThemeToggle}</View>
        </View>
      </SafeAreaView>
    );
  }

  // ── LOGGED IN VIEW ──
  const roleColor = profile.role === 'auctioneer' ? Colors.gold : '#16A34A';
  const kycColor = profile.kyc_status === 'approved' ? '#16A34A' : profile.kyc_status === 'pending' ? '#D97706' : '#DC2626';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
      {/* Profile header banner */}
      <View style={s.profileBanner}>
        <Image source={require('../../assets/logo.png')} style={s.bannerLogo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={s.bannerName}>{profile.full_name}</Text>
          <Text style={s.bannerEmail}>{profile.email}</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={s.gearBtn}>
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Role / KYC pills */}
        <View style={[s.card, { backgroundColor: card, borderColor: border, marginBottom: 12, flexDirection: 'row', gap: 8 }]}>
          <View style={[s.pill, { backgroundColor: `${roleColor}18` }]}>
            <View style={[s.pillDot, { backgroundColor: roleColor }]} />
            <Text style={[s.pillText, { color: roleColor }]}>{profile.role}</Text>
          </View>
          <View style={[s.pill, { backgroundColor: `${kycColor}18` }]}>
            <View style={[s.pillDot, { backgroundColor: kycColor }]} />
            <Text style={[s.pillText, { color: kycColor }]}>KYC {profile.kyc_status}</Text>
          </View>
        </View>

        {/* Screen name for bidders */}
        {profile.role !== 'auctioneer' && (
          <ScreenNameEditor userId={session.user.id} currentName={(profile as any).screen_name ?? null} ink={ink} muted={muted} card={card} border={border} />
        )}

        {/* Auctioneer actions */}
        {profile.role === 'auctioneer' && (
          <AuctioneerPanel userId={session.user.id} ink={ink} muted={muted} card={card} border={border} />
        )}

        {/* Dark mode */}
        <View style={{ marginBottom: 12 }}>{ThemeToggle}</View>

        {/* Sign out */}
        <Pressable onPress={signOut} style={[s.btn, { borderWidth: 1.5, borderColor: '#DC2626', backgroundColor: 'transparent' }]}>
          <Text style={[s.btnText, { color: '#DC2626' }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // Guest
  guestRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  guestLogo: { width: 100, height: 100, marginBottom: 14 },
  guestBrand: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.3, marginBottom: 4 },
  guestTagline: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 32 },
  guestCard: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  guestHeading: { fontSize: 20, fontWeight: '800', color: Colors.navy, marginBottom: 6 },
  guestSub: { fontSize: 13, color: 'rgba(15,23,42,0.55)', marginBottom: 20, lineHeight: 19 },
  guestBtn: { backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  guestBtnTxt: { color: Colors.navy, fontWeight: '800', fontSize: 16 },

  // Profile banner
  profileBanner: { backgroundColor: Colors.navy, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  bannerLogo: { width: 44, height: 44 },
  gearBtn: { padding: 6 },
  bannerName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bannerEmail: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },

  // Cards
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 13, marginTop: 2 },

  // Pills
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  pillDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  pillText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  btn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
});
