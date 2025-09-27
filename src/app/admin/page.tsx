'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import RankingsAdmin from './_components/RankingsAdmin';
import IdeasAdmin from './_components/IdeasAdmin';
import DischargeAdmin from './_components/DischargeAdmin';
import RosterAdmin from './_components/RosterAdmin';

type TabKey = 'rankings' | 'ideas' | 'discharge' | 'roster';

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<TabKey>('rankings');

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/'); return; }
      const { data: prof } = await supabaseBrowser
        .from('profiles').select('is_admin').eq('id', data.session.user.id).single();
      if (!prof?.is_admin) { router.replace('/dashboard'); return; }
      setIsAdmin(true);
      setReady(true);
    })();
  }, [router]);

  if (!ready) return <div className="card">Loading…</div>;
  if (!isAdmin) return <div className="card">Admins only.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setTab('rankings')} className={`btn ${tab==='rankings'?'btn-primary':'btn-secondary'}`}>Hospitalist Rankings</button>
        <button onClick={()=>setTab('ideas')} className={`btn ${tab==='ideas'?'btn-primary':'btn-secondary'}`}>Ideas</button>
        <button onClick={()=>setTab('discharge')} className={`btn ${tab==='discharge'?'btn-primary':'btn-secondary'}`}>Discharge Delays</button>
        <button onClick={()=>setTab('roster')} className={`btn ${tab==='roster'?'btn-primary':'btn-secondary'}`}>Roster</button>
      </div>

      {tab === 'rankings' && <RankingsAdmin />}
      {tab === 'ideas' && <IdeasAdmin />}
      {tab === 'discharge' && <DischargeAdmin />}
      {tab === 'roster' && <RosterAdmin />}
    </div>
  );
}
