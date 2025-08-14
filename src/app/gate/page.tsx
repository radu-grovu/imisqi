'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GatePage() {
  const router = useRouter();
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
      router.replace('/'); // go to landing (login/register)
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '48px auto', padding: 16 }}>
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
    </main>
  );
}
