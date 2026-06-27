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
  // No unique constraint on auction_id, so upsert's ON CONFLICT can't target
  // it — update the existing row (created at scheduling time) and only
  // insert if one doesn't exist yet (host went live without pre-scheduling).
  const { data: updated, error: updateError } = await supabase
    .from('live_sessions')
    .update({ status: 'live' })
    .eq('auction_id', auctionId)
    .select('id');
  if (updateError) throw new Error(`Failed to mark session live: ${updateError.message}`);

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase
      .from('live_sessions')
      .insert({ auction_id: auctionId, auctioneer_id: userId, channel_name: auctionId, status: 'live' });
    if (insertError) throw new Error(`Failed to mark session live: ${insertError.message}`);
  }

  const { error: auctionError } = await supabase
    .from('auctions')
    .update({ status: 'active' })
    .eq('id', auctionId)
    .eq('status', 'scheduled');
  if (auctionError) throw new Error(`Failed to activate auction: ${auctionError.message}`);
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
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', auctionId);
  if (auctionError) throw new Error(`Failed to close auction: ${auctionError.message}`);
}
