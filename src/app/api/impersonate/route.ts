import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const overridePw = process.env.OVERRIDE_PASSWORD || '';  // define in .env
  if (password !== overridePw || !overridePw) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Generate a magic link for the given email (impersonation)
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
  });
  if (error || !data?.properties?.hashed_token) {
    console.error('Error generating magic link:', error);
    return NextResponse.json({ error: 'Impersonation failed' }, { status: 500 });
  }
  // Return the hashed token so the client can verify it
  return NextResponse.json({ token: data.properties.hashed_token });
}
