// src/app/delay/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser';
import CompletionCalendar from '../../components/CompletionCalendar';

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DelayRecorderPage() {
  const router = useRouter();
  const [initials, setInitials] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Ensure the user is logged in and fetch their profile
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace('/');
        return;
      }
      const { data: prof, error } = await supabaseBrowser
        .from('profiles')
        .select('initials, is_admin')
        .eq('id', data.session.user.id)
        .single();
      if (!error && prof) {
        setInitials(prof.initials ?? null);
        setIsAdmin(!!prof.is_admin);
      }
      setReady(true);
    })();
  }, [router]);

  const today = useMemo(() => isoToday(), []);

  if (!ready) {
    return <div className="card">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Discharge Delay Recorder</h1>
          {initials && <p className="text-sm text-gray-600">Signed in as {initials}</p>}
        </div>
        <div className="flex gap-2">
          {/* Button to fill today's survey */}
          <button
            type="button"
            onClick={() => router.push(`/survey/${today}`)}
            className="btn btn-primary"
          >
            Fill Today
          </button>
          {/* Admin link (optional, in case admin wants quick access) */}
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

      {/* Calendar showing completed/missing surveys */}
      <div className="card">
        <p className="text-sm text-gray-600 mb-3">
          Click a day to fill or review the survey. <span className="font-medium text-green-600">Green</span> = submitted, <span className="font-medium text-red-600">Red</span> = required but missing.
        </p>
        <CompletionCalendar />
      </div>
    </div>
  );
}
