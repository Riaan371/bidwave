import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ONESIGNAL_APP_ID = 'e7382b34-2b96-4f8e-97db-7ef9505ae8c3';
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? '';

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record ?? payload;

    let title = 'West Coast Pickers';
    let message = 'A new auction is available!';
    let url = 'https://bidwave.pages.dev';

    if (record.type === 'timed') {
      title = '⏱ New Timed Auction';
      message = `"${record.title}" is now open for bidding. Place your bids before the deadline!`;
      url = `https://bidwave.pages.dev/auction/${record.id}`;
    } else if (record.status === 'live') {
      title = '🔴 Auction Going LIVE Now!';
      message = `"${record.title}" is starting — join the live bidding now!`;
      url = `https://bidwave.pages.dev/live/${record.id}`;
    } else if (record.status === 'scheduled') {
      title = '📅 Auction Scheduled';
      message = `"${record.title}" has been scheduled. Mark your calendar!`;
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['Total Subscribed'],
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
