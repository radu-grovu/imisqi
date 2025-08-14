'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser';

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        // not signed in → go to login
        router.replace('/');
        return;
      }
      setReady(true);
    }
    check();
  }, [router]);

  if (!ready) return <p style={{ padding: 16 }}>Loading…</p>;

  // your existing dashboard UI (kept simple for now)
  return (
    <main style={{ padding: 16 }}>
      <h1>Hospitalist Daily Survey</h1>
      <h2>Dashboard</h2>
      <p>No active campaigns yet.</p>
    </main>
  );
}
