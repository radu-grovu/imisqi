'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser';
import CompletionCalendar from '../../components/CompletionCalendar';

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace('/');
        return;
      }
      setReady(true);
    }
    check();
  }, [router]);

  if (!ready) return <p style={{ padding: 16 }}>Loading…</p>;

  return (
    <main style={{ padding: 16 }}>
      <h1>Hospitalist Daily Survey</h1>
      <h2>Dashboard</h2>
      <p style={{ marginBottom: 12 }}>
        Click a day to fill or review the survey. Green = submitted, Red = missing.
      </p>
      <CompletionCalendar />
    </main>
  );
}
