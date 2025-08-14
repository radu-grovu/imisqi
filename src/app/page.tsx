'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../lib/supabaseBrowser'; // note the relative path

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const { data, error } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password: pw,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      // Signed in — go to dashboard
      router.push('/dashboard');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '48px auto', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Hospitalist Daily Survey</h1>
      <p style={{ marginBottom: 16 }}>
        Log in with your email and password. Don’t have an account?{' '}
        <a href="/register">Create one here</a>.
      </p>

      <form onSubmit={onLogin} style={{ display: 'grid', gap: 12 }}>
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
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={{ padding: 10, fontSize: 16 }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{ padding: '10px 14px', fontSize: 16 }}
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      {msg && (
        <p style={{ color: 'crimson', marginTop: 12 }}>
          {msg}
        </p>
      )}
    </main>
  );
}
