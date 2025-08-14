'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser';
import CompletionCalendar from '../../components/CompletionCalendar';

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [initials, setInitials] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace('/');
        return;
      }
      // fetch initials (optional for future assignment logic)
      const { data: profs } = await supabaseBrowser
        .from('profiles')
        .select('initials')
        .eq('id', data.session.user.id)
        .single();
      setInitials(profs?.initials ?? null);
      setReady(true);
    }
    check();
  }, [router]);

  const today = useMemo(() => isoToday(), []);

  if (!ready) return <p style={{ padding: 16 }}>Loading…</p>;

  return (
    <main style={{ padding: 16 }}>
      <h1>Hospitalist Daily Survey</h1>
      <h2>Dashboard</h2>

      <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px' }}>
        <button type="button" onClick={() => router.push(`/survey/${today}`)}>
          Fill Today
        </button>
      </div>

      <p style={{ marginBottom: 12 }}>
        Click a day to fill or review the survey. Green = submitted, Red = missing.
      </p>
      <CompletionCalendar />
    </main>
  );
}
