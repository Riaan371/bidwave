import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ONESIGNAL_APP_ID = 'e7382b34-2b96-4f8e-97db-7ef9505ae8c3';
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY') ?? '';

serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record ?? body.new ?? body;

    const status = record.status;
    const title = record.title ?? 'Live Auction';

    let heading = '';
    let message = '';
    let url = 'https://bidwave.pages.dev';

    if (status === 'scheduled') {
      heading = '📅 New Auction Scheduled';
      message = `"${title}" is coming up — mark your calendar!`;
    } else if (status === 'live') {
      heading = '🔴 LIVE NOW — West Coast Pickers';
      message = `"${title}" is live! Tap to join the bidding now.`;
      url = `https://bidwave.pages.dev/live/${record.auction_id}`;
    } else {
      return new Response('ignored', { status: 200 });
    }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['Total Subscriptions'],
        headings: { en: heading },
        contents: { en: message },
        url,
        chrome_web_icon: 'https://bidwave.pages.dev/icon-192-v2.png',
        firefox_icon: 'https://bidwave.pages.dev/icon-192-v2.png',
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
