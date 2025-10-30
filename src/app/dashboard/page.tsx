// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser';

export default function DashboardPage() {
  const router = useRouter();
  const [initials, setInitials] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // On mount, check for an active session and load profile
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        // Not logged in, redirect to landing
        router.replace('/');
        return;
      }
      // Fetch the user's initials (and possibly other info if needed)
      const { data: prof, error } = await supabaseBrowser
        .from('profiles')
        .select('initials')
        .eq('id', data.session.user.id)
        .single();
      if (!error && prof) {
        setInitials(prof.initials);
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return <div className="card">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {initials && <p className="text-sm text-gray-600">Signed in as {initials}</p>}
      </div>

      {/* Menu grid for sections */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Discharge Delay Recorder option */}
        <a href="/delay" className="card hover:bg-gray-50 focus:ring focus:ring-brand-100 block">
          <h2 className="text-lg font-medium mb-1">Discharge Delay Recorder</h2>
          <p className="text-sm text-gray-700">
            Track daily discharge delays and fill out required delay surveys.
          </p>
        </a>

        {/* Hospitalist Survey option */}
        <a href="/survey" className="card hover:bg-gray-50 focus:ring focus:ring-brand-100 block">
          <h2 className="text-lg font-medium mb-1">Hospitalist Survey</h2>
          <p className="text-sm text-gray-700">
            Complete the latest survey by selecting colleagues who meet each question's criteria.
          </p>
        </a>

        {/* Ideas for Improvement option */}
        <a href="/ideas" className="card hover:bg-gray-50 focus:ring focus:ring-brand-100 block">
          <h2 className="text-lg font-medium mb-1">Ideas for Improvement</h2>
          <p className="text-sm text-gray-700">
            Suggest improvements for management, admitting, rounding, or night shifts.
          </p>
        </a>
      </div>
    </div>
  );
}
