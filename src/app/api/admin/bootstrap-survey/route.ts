import { NextResponse } from 'next/server';
import { ensureSurveySchema } from '@/lib/surveySchema';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function userHasAdminAccess(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: prof, error: profError } = await supabase
    .from('profiles')
    .select('initials, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (profError) {
    console.error('Failed to fetch profile for admin check', profError);
    return false;
  }

  let allowed = false;
  const initials = (prof?.initials ?? '').toUpperCase();
  if (prof?.is_admin) {
    allowed = true;
  } else if (initials === 'RG') {
    allowed = true;
  } else if (initials) {
    const { data: roster, error: rosterError } = await supabase
      .from('roster')
      .select('is_admin')
      .eq('initials', prof?.initials)
      .maybeSingle();

    if (rosterError) {
      console.error('Failed to fetch roster for admin check', rosterError);
    }

    if (roster?.is_admin) {
      allowed = true;
    }
  }

  return allowed;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Supabase configuration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: userRes, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uid = userRes.user.id;
  const allowed = await userHasAdminAccess(uid);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureSurveySchema();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to bootstrap survey schema', err);
    const message = err instanceof Error ? err.message : 'Failed to bootstrap survey schema';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
