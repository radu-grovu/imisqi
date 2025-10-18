'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../lib/supabaseBrowser';

type RosterRow = { initials: string; full_name: string; active: boolean };

export default function Landing() {
  const router = useRouter();
  const [gateOk, setGateOk] = useState<boolean>(false);

  useEffect(() => {
    // Check if gate cookie already present by attempting to fetch roster
    (async () => {
      try {
        const { data, error } = await supabaseBrowser.from('roster').select('initials').limit(1);
        if (!error) setGateOk(true);
      } catch {
        setGateOk(false);
      }
    })();
  }, []);

  return (
    <main style={{ maxWidth: 520, margin: '48px auto', padding: 16 }}>
      {!gateOk ? <Gate onPassed={() => setGateOk(true)} /> : <LoginForm />}
    </main>
  );
}

function Gate({ onPassed }: { onPassed: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        setMsg('Incorrect password.');
        return;
      }
      onPassed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 style={{ marginBottom: 8 }}>Access</h1>
      <p style={{ marginBottom: 16 }}>Enter the shared password to continue.</p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <input
          type="password"
          placeholder="Shared password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={{ padding: 10, fontSize: 16 }}
          autoFocus
        />
        <button type="submit" disabled={busy} style={{ padding: '10px 14px', fontSize: 16 }}>
          {busy ? 'Checking…' : 'Continue'}
        </button>
        {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
      </form>
    </>
  );
}

function LoginForm() {
  const router = useRouter();
  const [initials, setInitials] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);

  useEffect(() => {
    // Load active roster for initials dropdown
    (async () => {
      const { data, error } = await supabaseBrowser
        .from('roster')
        .select('initials, full_name, active')
        .eq('active', true)
        .order('initials');
      if (!error && data) setRoster(data);
    })();
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (!initials) {
        setMsg('Select your initials.');
        return;
      }
      const domain = process.env.NEXT_PUBLIC_SYNTHETIC_EMAIL_DOMAIN || 'imis.local';
      const email = `${initials}@${domain}`;
      // Attempt normal sign-in with provided password
      const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password: pw });
      if (error) {
        // If normal sign-in failed, attempt override password login
        const res = await fetch('/api/override-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initials, password: pw }),
        });
        if (!res.ok) {
          // Override password was incorrect or another error occurred
          setMsg('Incorrect password.');
          return;
        }
        // If override login successful, verify the OTP token to create session
        const { hashedToken } = await res.json();
        const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
          token_hash: hashedToken,
          type: 'email',
        });
        if (verifyError) {
          setMsg(verifyError.message || 'Login failed. Please try again.');
          return;
        }
      }
      // At this point, user is signed in (either normally or via override)
      router.push('/dashboard');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 style={{ marginBottom: 8 }}>Sign In</h1>
      <p style={{ marginBottom: 16 }}>Choose your initials and enter your password to sign in.</p>
      {/* New Account button */}
      <div style={{ marginBottom: 24 }}>
        <a href="/register" className="btn btn-secondary">
          New here? Create an account
        </a>
      </div>
      <form onSubmit={onLogin} style={{ display: 'grid', gap: 12 }}>
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

        <input
          type="password"
          required
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={{ padding: 10, fontSize: 16 }}
        />

        <button type="submit" disabled={busy} style={{ padding: '10px 14px', fontSize: 16 }}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
      </form>
    </>
  );
}
