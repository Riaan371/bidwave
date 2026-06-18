// Supabase Edge Function — generates Agora RTC tokens server-side.
// Deploy: supabase functions deploy agora-token --project-ref mokpadcikpebwqsdsvcy
// Set secret: supabase secrets set AGORA_APP_CERTIFICATE=<cert> --project-ref mokpadcikpebwqsdsvcy

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RtcTokenBuilder, RtcRole } from 'https://esm.sh/agora-token@2.0.4';

const APP_ID = Deno.env.get('AGORA_APP_ID') ?? '84e49bb27e1f4d6ebc297960e2b014d1';
const APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Unauthorized');

    const { channel, uid, role } = await req.json();
    if (!channel) throw new Error('channel is required');

    const numUid = uid ?? 0;
    const expireTs = Math.floor(Date.now() / 1000) + 3600;
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const token = APP_CERTIFICATE
      ? RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channel, numUid, agoraRole, expireTs, expireTs)
      : null;

    return new Response(
      JSON.stringify({ token, appId: APP_ID, channel, uid: numUid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
