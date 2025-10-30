import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import sgMail from '@sendgrid/mail';

const sendgridKey = process.env.SENDGRID_API_KEY;
if (sendgridKey) {
  sgMail.setApiKey(sendgridKey);
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!sendgridKey) {
    console.error('SendGrid API key is not configured');
    return NextResponse.json({ error: 'SendGrid not configured' }, { status: 500 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error('Supabase admin client not configured', err);
    return NextResponse.json(
      { error: 'Supabase admin client not configured' },
      { status: 500 }
    );
  }

  // Today (ET by default). For true per-campaign TZ delivery, move this to a queue per tz/hour.
  const today = ymd(new Date());

  // Active campaigns
  const { data: campaigns, error } = await supabase.from('campaigns').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sends: Promise<any>[] = [];
  for (const c of campaigns || []) {
    const idx = Math.floor(
      (Date.parse(today) - Date.parse(c.start_date)) / (1000 * 60 * 60 * 24)
    );
    const inWindow = idx >= 0 && idx < c.days;
    if (!inWindow) continue;

    const { data: recips } = await supabase
      .from('campaign_recipients')
      .select('email')
      .eq('campaign_id', c.id);
    const list = (recips || []).map(r => r.email).filter(Boolean);

    for (const email of list) {
      const surveyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/survey/${today}?campaign=${c.id}`;
      sends.push(
        sgMail.send({
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL!,
          subject: `${c.name} — Daily Survey (${today})`,
          html: `<p>Please complete today’s 60‑second survey.</p>
               <p><a href="${surveyUrl}">Open today’s survey</a></p>
               <p>You can also backfill missed days from your <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard">dashboard</a>.</p>`
        })
      );
    }
  }

  await Promise.allSettled(sends);
  return NextResponse.json({ ok: true, count: sends.length });
}
