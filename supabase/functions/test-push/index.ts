import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ONESIGNAL_APP_ID = 'e7382b34-2b96-4f8e-97db-7ef9505ae8c3';
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
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
        include_subscription_ids: ['887af7a8-6870-4a05-bcac-469fb10a4596'],
        headings: { en: '🔔 Test Notification' },
        contents: { en: 'Push notifications are working on West Coast Pickers!' },
        url: 'https://bidwave.pages.dev',
        chrome_web_icon: 'https://bidwave.pages.dev/icon-192-v3.png',
      }),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
});
