// Web-only Agora wrapper (agora-rtc-sdk-ng runs in browser).
// On native mobile, swap this for react-native-agora via EAS Development Build.

import { supabase } from './supabase';

const APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '';

export async function getAgoraToken(channel: string, role: 'publisher' | 'subscriber'): Promise<{ token: string; appId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Must be logged in');

  const resp = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/agora-token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ channel, role }),
    }
  );
  const json = await resp.json();
  if (json.error) throw new Error(json.error);
  return { token: json.token, appId: json.appId ?? APP_ID };
}

export async function markSessionLive(auctionId: string, userId: string) {
  const { error } = await supabase.from('live_sessions').upsert(
    { auction_id: auctionId, auctioneer_id: userId, channel_name: auctionId, status: 'live' },
    { onConflict: 'auction_id' }
  );
  if (error) throw new Error(`Failed to mark session live: ${error.message}`);
}

export async function markSessionEnded(auctionId: string) {
  const { error } = await supabase
    .from('live_sessions')
    .update({ status: 'ended' })
    .eq('auction_id', auctionId)
    .eq('status', 'live');
  if (error) throw new Error(`Failed to end session: ${error.message}`);

  const { error: auctionError } = await supabase
    .from('auctions')
    .update({ status: 'closed' })
    .eq('id', auctionId);
  if (auctionError) throw new Error(`Failed to close auction: ${auctionError.message}`);
}
