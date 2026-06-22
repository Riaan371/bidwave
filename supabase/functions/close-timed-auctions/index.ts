import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REPORT_EMAIL = 'andrew.cassisa2@gmail.com';

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Find all active timed auctions whose deadline has passed
  const { data: expiredAuctions } = await supabase
    .from('auctions')
    .select('id, title, end_at')
    .eq('type', 'timed')
    .eq('status', 'active')
    .lt('end_at', new Date().toISOString());

  if (!expiredAuctions || expiredAuctions.length === 0) {
    return new Response('No auctions to close', { status: 200 });
  }

  for (const auction of expiredAuctions) {
    // 1. Close the auction
    await supabase.from('auctions').update({ status: 'closed' }).eq('id', auction.id);

    // 2. Fetch all lots in this auction
    const { data: lots } = await supabase
      .from('lots')
      .select('id, title, category, starting_bid, current_bid, winner_id')
      .eq('auction_id', auction.id);

    // 3. Build email report
    const closedAt = new Date(auction.end_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
    let totalRevenue = 0;
    let soldCount = 0;

    const lotRows = (lots ?? []).map((lot: any) => {
      const sold = lot.current_bid && lot.winner_id;
      const hammer = lot.current_bid ?? lot.starting_bid;
      if (sold) { totalRevenue += hammer; soldCount++; }
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${lot.title}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${lot.category ?? '—'}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">R${(lot.starting_bid ?? 0).toLocaleString('en-ZA')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:${sold ? '#16A34A' : '#6B7280'}">
            ${sold ? `R${hammer.toLocaleString('en-ZA')}` : 'No bids'}
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee">${sold ? '✅ SOLD' : '❌ Unsold'}</td>
        </tr>`;
    }).join('');

    const html = `
      <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
        <div style="background:#0D1B2E;padding:24px;border-radius:12px 12px 0 0">
          <h1 style="color:#C49A22;margin:0;font-size:22px">West Coast Pickers</h1>
          <p style="color:rgba(255,255,255,0.7);margin:4px 0 0">Auction Closed Report</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee">
          <h2 style="color:#0D1B2E">${auction.title}</h2>
          <p style="color:#6B7280">Closed: ${closedAt}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
            <thead>
              <tr style="background:#F8F7F4">
                <th style="padding:10px;text-align:left;font-size:12px;color:#6B7280">LOT</th>
                <th style="padding:10px;text-align:left;font-size:12px;color:#6B7280">CATEGORY</th>
                <th style="padding:10px;text-align:left;font-size:12px;color:#6B7280">STARTING BID</th>
                <th style="padding:10px;text-align:left;font-size:12px;color:#6B7280">HAMMER PRICE</th>
                <th style="padding:10px;text-align:left;font-size:12px;color:#6B7280">STATUS</th>
              </tr>
            </thead>
            <tbody>${lotRows}</tbody>
          </table>
          <div style="background:#F8F7F4;border-radius:8px;padding:16px;margin-top:24px">
            <p style="margin:0;font-size:14px;color:#0D1B2E"><strong>Total Lots:</strong> ${lots?.length ?? 0}</p>
            <p style="margin:4px 0;font-size:14px;color:#0D1B2E"><strong>Lots Sold:</strong> ${soldCount}</p>
            <p style="margin:4px 0;font-size:18px;color:#C49A22"><strong>Total Revenue: R${totalRevenue.toLocaleString('en-ZA')}</strong></p>
          </div>
        </div>
      </div>`;

    // 4. Send email via Resend
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'West Coast Pickers <reports@westcoastpickers.co.za>',
          to: [REPORT_EMAIL],
          subject: `Auction Closed: ${auction.title}`,
          html,
        }),
      });
    }
  }

  return new Response(`Closed ${expiredAuctions.length} auction(s)`, { status: 200 });
});
