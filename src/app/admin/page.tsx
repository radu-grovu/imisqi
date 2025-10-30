'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import SurveyAdmin from './_components/SurveyAdmin';
import IdeasAdmin from './_components/IdeasAdmin';
import DischargeAdmin from './_components/DischargeAdmin';
import RosterAdmin from './_components/RosterAdmin';

type TabKey = 'survey' | 'ideas' | 'discharge' | 'roster';

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<TabKey>('survey');

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      if (!sessionData.session) {
        router.replace('/');
        return;
      }
      const userId = sessionData.session.user.id;
      // Check the user's profile for admin status and initials
      const { data: prof } = await supabaseBrowser
        .from('profiles')
        .select('initials, is_admin')
        .eq('id', userId)
        .single();
      let allowed = false;
      if (prof) {
        if (prof.is_admin) allowed = true;
        if ((prof.initials ?? '').toUpperCase() === 'RG') allowed = true;
        if (!allowed) {
          const { data: rosterRec } = await supabaseBrowser
            .from('roster')
            .select('is_admin')
            .eq('initials', prof.initials)
            .single();
          if (rosterRec?.is_admin) {
            allowed = true;
          }
        }
      }
      if (!allowed) {
        // Not an admin user – redirect to dashboard
        router.replace('/dashboard');
        return;
      }
      setIsAdmin(true);
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return <div className="card">Loading…</div>;
  }
  if (!isAdmin) {
    // This state should not normally be reached due to the redirect above,
    // but we include a fallback message just in case.
    return <div className="card">Admins only.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab('survey')}
          className={`btn ${tab === 'survey' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Hospitalist Survey
        </button>
        <button
          onClick={() => setTab('ideas')}
          className={`btn ${tab === 'ideas' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Ideas
        </button>
        <button
          onClick={() => setTab('discharge')}
          className={`btn ${tab === 'discharge' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Discharge Delays
        </button>
        <button
          onClick={() => setTab('roster')}
          className={`btn ${tab === 'roster' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Roster
        </button>
      </div>

      {tab === 'survey' && <SurveyAdmin />}
      {tab === 'ideas' && <IdeasAdmin />}
      {tab === 'discharge' && <DischargeAdmin />}
      {tab === 'roster' && <RosterAdmin />}
    </div>
  );
}
