'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser';

type RosterRow = { initials: string; full_name: string; active: boolean };

export default function RegisterPage() {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [initials, setInitials] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabaseBrowser
        .from('roster')
        .select('initials,full_name,active')
        .eq('active', true)
        .order('initials');
      if (!error && data) setRoster(data);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!initials) {
      setMsg('Please select your initials.');
      return;
    }
    if (!confirm) {
      setMsg('Please confirm you selected the correct initials.');
      return;
    }
    if (pw.length < 8) {
      setMsg('Password must be at least 8 characters.');
      return;
    }
    if (pw !== pw2) {
      setMsg('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const domain = process.env.NEXT_PUBLIC_SYNTHETIC_EMAIL_DOMAIN || 'imis.local';
      const email = `${initials}@${domain}`;

      // 1) create account
      const { data: signUpData, error: signUpErr } = await supabaseBrowser.auth.signUp({
        email,
        password: pw,
      });
      if (signUpErr) {
        setMsg(signUpErr.message);
        return;
      }

      // 2) ensure session (some projects return null session on signUp)
      if (!signUpData.session) {
        const { error: signInErr } = await supabaseBrowser.auth.signInWithPassword({
          email,
          password: pw,
        });
        if (signInErr) {
          setMsg(signInErr.message);
          return;
        }
      }

      // 3) store initials on profile (so we can join assignments later)
      const { data: sess } = await supabaseBrowser.auth.getSession();
      const uid = sess.session?.user?.id;
      if (uid) {
        await supabaseBrowser
          .from('profiles')
          .update({ initials })   // user can update their own profile (RLS)
          .eq('id', uid);
      }

      // 4) go to dashboard
      router.push('/dashboard');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '48px auto', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Create account</h1>
      <p style={{ marginBottom: 16 }}>
        Select your initials, confirm, then set your password.
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <select
          value={initials}
          onChange={(e) => setInitials(e.target.value)}
          required
          style={{ padding: 10, fontSize: 16 }}
        >
          <option value="">Select initials…</option>
          {roster.map((r) => (
            <option key={r.initials} value={r.initials}>
              {r.initials} — {r.full_name}
            </option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          I confirm I selected the correct initials.
        </label>

        <input
          type="password"
          placeholder="Password (min 8 chars)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          style={{ padding: 10, fontSize: 16 }}
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          required
          style={{ padding: 10, fontSize: 16 }}
        />

        <button type="submit" disabled={busy} style={{ padding: '10px 14px', fontSize: 16 }}>
          {busy ? 'Creating…' : 'Create Account'}
        </button>

        {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
      </form>
    </main>
  );
}
