import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const body = await req.json();
  const { name, startDate, days, tz, hour, emails } = body as {
    name: string; startDate: string; days: number; tz: string; hour: number; emails: string[];
  };

  // Create campaign
  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns')
    .insert({ name, start_date: startDate, days, tz, daily_send_hour: hour })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Store recipient emails (we link users when they log in via /api/sync-memberships)
  const rows = emails.map(email => ({ campaign_id: campaign.id, email }));
  const { error: e2 } = await supabaseAdmin.from('campaign_recipients').insert(rows);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

  return NextResponse.json({ ok: true, campaignId: campaign.id });
}
