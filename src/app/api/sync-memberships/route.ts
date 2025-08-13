import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST() {
  // We cannot read the user on the server without cookies parsing in this minimal setup.
  // Instead, the client calls this route only when signed in and passes the access token.
  // For the pilot, we’ll just no-op and rely on responses using profile_id from session.
  // Optional: Expand to map recipients.email -> profiles.id and insert into campaign_providers.
  return NextResponse.json({ ok: true });
}
