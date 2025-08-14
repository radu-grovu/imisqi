'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser'; // note the relative path

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (pw !== pw2) {
      setMsg('Passwords do not match.');
      return;
    }
    if (pw.length < 8) {
      setMsg('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      // 1) Create the user (no email confirmation required per your Supabase settings)
      const { data: signUpData, error: signUpErr } = await supabaseBrowser.auth.signUp({
        email,
        password: pw,
      });
      if (signUpErr) {
        setMsg(signUpErr.message);
        return;
      }

      // 2) If signUp didn't return a session (some settings), sign in immediately
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

      // 3) Go to dashboard now that the user is logged in
      router.push('/dashboard');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '48px auto', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Create your account</h1>
      <p style={{ marginBottom: 16 }}>
        Use your work email. After creating your account, you’ll land on the dashboard.
      </p>

      <form onSubmit={onRegister} style={{ display: 'grid', gap: 12 }}>
        <input
          type="email"
          required
          placeholder="you@hospital.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10, fontSize: 16 }}
        />
        <input
          type="password"
          required
          placeholder="Password (min 8 chars)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={{ padding: 10, fontSize: 16 }}
        />
        <input
          type="password"
          required
          placeholder="Confirm password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          style={{ padding: 10, fontSize: 16 }}
        />
        <button type="submit" disabled={busy} style={{ padding: '10px 14px', fontSize: 16 }}>
          {busy ? 'Creating…' : 'Create Account'}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>
        Already have an account? <a href="/">Sign in</a>
      </p>

      {msg && <p style={{ color: 'crimson', marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
