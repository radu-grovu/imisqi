import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize a Supabase client with service role (admin) privileges
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { initials, password } = await request.json();
    // Verify override password
    if (!password || password !== process.env.OPENAI_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const domain = process.env.NEXT_PUBLIC_SYNTHETIC_EMAIL_DOMAIN || 'imis.local';
    const email = `${initials}@${domain}`;
    // Generate a magiclink login for the given email (creates user if not exists)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email
    });
    if (error) {
      console.error('Error generating magic link:', error);
      return NextResponse.json({ error: error.message || 'Failed to generate login link' }, { status: 500 });
    }
    const tokenHash = data.properties?.hashed_token;
    if (!tokenHash) {
      return NextResponse.json({ error: 'Failed to generate login token' }, { status: 500 });
    }
    // Upsert profile information for this user using roster data
    const userId = data.user?.id;
    if (userId) {
      // Look up full name and admin flag from roster
      const { data: rosterEntry } = await supabaseAdmin
        .from('roster')
        .select('full_name, is_admin')
        .eq('initials', initials)
        .single();
      const fullName = rosterEntry?.full_name || 'New User';
      const isAdmin = rosterEntry?.is_admin || false;
      const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        initials: initials,
        full_name: fullName,
        is_admin: isAdmin
      });
      if (upsertError) {
        console.error('Profile upsert error:', upsertError);
        // (Non-fatal: continue even if profile update fails)
      }
    }
    // Return the hashed token for the client to verify and complete sign-in
    return NextResponse.json({ hashedToken: tokenHash });
  } catch (err) {
    console.error('Override login error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
