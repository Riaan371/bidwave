import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ONESIGNAL_APP_ID = 'e7382b34-2b96-4f8e-97db-7ef9505ae8c3';
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? '';

serve(async (req) => {
  try {
    const payload = await req.json();
    const table = payload.table; // 'auctions' or 'live_sessions' — two separate webhooks call this function
    const record = payload.record ?? payload;
    const oldRecord = payload.old_record ?? null;

    // Only notify when status actually changed (avoid spamming on unrelated
    // row updates, e.g. lots/end_at edits, or live_sessions current_lot_index
    // changes during a live event, that don't change status).
    if (oldRecord && oldRecord.status === record.status) {
      return new Response(JSON.stringify({ skipped: 'status unchanged' }), { status: 200 });
    }

    let title = 'West Coast Picker';
    let message = 'A new auction is available!';
    let url = 'https://bidwave.pages.dev';
    let shouldSend = true;

    if (table === 'auctions') {
      // Only timed auctions are announced from this table — live auctions are
      // announced via the live_sessions row created alongside them, below,
      // to avoid sending a duplicate "scheduled" notification for both rows.
      if (record.type === 'timed' && record.status === 'active') {
        title = '⏱ New Timed Auction';
        message = `"${record.title}" is now open for bidding. Place your bids before the deadline!`;
        url = `https://bidwave.pages.dev/auction/${record.id}`;
      } else {
        shouldSend = false;
      }
    } else if (table === 'live_sessions') {
      if (record.status === 'scheduled') {
        title = '📅 Auction Scheduled';
        message = `"${record.title}" has been scheduled. Mark your calendar!`;
        url = `https://bidwave.pages.dev/live/${record.auction_id}`;
      } else if (record.status === 'live') {
        title = '🔴 Auction Going LIVE Now!';
        message = `"${record.title}" is starting — join the live bidding now!`;
        url = `https://bidwave.pages.dev/live/${record.auction_id}`;
      } else {
        shouldSend = false;
      }
    } else {
      shouldSend = false;
    }

    if (!shouldSend) {
      return new Response(JSON.stringify({ skipped: 'no matching status transition' }), { status: 200 });
    }

    const response = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: 'push',
        included_segments: ['Total Subscriptions'],
        headings: { en: title },
        contents: { en: message },
        url,
        chrome_web_icon: 'https://bidwave.pages.dev/assets/logo.png',
        firefox_icon: 'https://bidwave.pages.dev/assets/logo.png',
      }),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
