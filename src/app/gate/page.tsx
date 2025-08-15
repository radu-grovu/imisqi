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
      router.replace('/');
    } finally {
      setBusy(false);
    }
  }

  async function resetCookie() {
    await fetch('/api/gate/clear', { method: 'POST' });
    setMsg('Gate cookie cleared. You can re-enter the password now.');
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card">
        <h1 className="text-xl font-semibold mb-2">Access</h1>
        <p className="text-sm text-gray-600 mb-4">
          Enter the shared password to continue.
        </p>

        <form onSubmit={onSubmit} className="grid gap-3">
          <input
            type="password"
            placeholder="Shared password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="input"
            autoFocus
          />
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? 'Checking…' : 'Continue'}
          </button>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </form>

        <div className="mt-4">
          <button onClick={resetCookie} type="button" className="btn btn-secondary">
            Reset gate cookie (testing)
          </button>
        </div>
      </div>
    </div>
  );
}
