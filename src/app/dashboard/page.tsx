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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function check() {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace('/');
        return;
      }
      const { data: prof, error } = await supabaseBrowser
        .from('profiles')
        .select('initials,is_admin')
        .eq('id', data.session.user.id)
        .single();
      if (!error && prof) {
        setInitials(prof.initials ?? null);
        setIsAdmin(!!prof.is_admin);
      }
      setReady(true);
    }
    check();
  }, [router]);

  const today = useMemo(() => isoToday(), []);

  if (!ready) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="card text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-600">{initials ? `Signed in as ${initials}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/survey/${today}`)}
            className="btn btn-primary"
          >
            Fill Today
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="btn btn-secondary"
            >
              Admin
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <p className="text-sm text-gray-600 mb-3">
          Click a day to fill or review the survey. <span className="font-medium">Green</span> = submitted,&nbsp;
          <span className="font-medium">Red</span> = required but missing.
        </p>
        <CompletionCalendar />
      </div>
    </div>
  );
}
