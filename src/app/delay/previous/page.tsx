'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Row = {
  id: number;
  event_date: string;             // YYYY-MM-DD
  provider_initials: string;
  cause: string;
  patients_delayed: number;
  is_demo?: boolean;
};

const CAUSES = [
  'Bed not ready',
  'Late consult',
  'Imaging delay',
  'Pharmacy processing',
  'Transport',
  'Awaiting placement',
  'Insurance auth'
];

function today() { return new Date().toISOString().slice(0,10); }

export default function PreviousDelaysPage() {
  const router = useRouter();
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [myInitials, setMyInitials] = useState<string>('');
  const [date, setDate] = useState<string>(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/auth/login'); return; }
      setSessionUserId(data.session.user.id);
      const { data: prof } = await supabaseBrowser.from('profiles').select('initials').eq('id', data.session.user.id).single();
      setMyInitials(prof?.initials ?? '');
      await load(data.session.user.id, date);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(userId: string, d: string) {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('discharge_surveys')
      .select('id, event_date, provider_initials, cause, patients_delayed, is_demo')
      .eq('user_id', userId)
      .eq('event_date', d)
      .order('id', { ascending: true });
    if (error) setMsg(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  async function addRow() {
    if (!sessionUserId) return;
    const newRow = {
      event_date: date,
      provider_initials: myInitials || '??',
      cause: CAUSES[0],
      patients_delayed: 0
    };
    const { data, error } = await supabaseBrowser
      .from('discharge_surveys')
      .insert(newRow)
      .select('id, event_date, provider_initials, cause, patients_delayed, is_demo')
      .single();
    if (error) { setMsg(error.message); return; }
    setRows(prev => [...prev, data as Row]);
  }

  async function saveRow(r: Row) {
    const { error } = await supabaseBrowser
      .from('discharge_surveys')
      .update({
        event_date: r.event_date,
        provider_initials: r.provider_initials,
        cause: r.cause,
        patients_delayed: r.patients_delayed
      })
      .eq('id', r.id);
    if (error) { setMsg(error.message); return; }
    setMsg('Saved.');
    setTimeout(()=>setMsg(null), 1500);
  }

  async function delRow(id: number) {
    if (!confirm('Delete this delay record?')) return;
    const { error } = await supabaseBrowser.from('discharge_surveys').delete().eq('id', id);
    if (error) { setMsg(error.message); return; }
    setRows(prev => prev.filter(x => x.id !== id));
  }

  function setField(id:number, field:keyof Row, value:any) {
    setRows(prev => prev.map(r => r.id===id ? { ...r, [field]: value } : r));
  }

  const totalPatients = useMemo(() => rows.reduce((s,r)=>s + (r.patients_delayed||0), 0), [rows]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Previous Delays</h1>

      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs">Date</label>
          <input type="date" className="input" value={date}
                 onChange={async (e)=>{ setDate(e.target.value); if (sessionUserId) await load(sessionUserId, e.target.value); }} />
        </div>
        <button className="btn btn-secondary" onClick={addRow}>Add Row</button>
        <div className="ml-auto text-sm text-gray-600">Total patients delayed: <b>{totalPatients}</b></div>
      </div>

      <div className="card">
        {loading ? <p>Loading…</p> : rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Cause</th><th>Patients</th><th>Provider</th><th></th></tr></thead>
              <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <select className="input" value={r.cause} onChange={(e)=>setField(r.id,'cause', e.target.value)}>
                      {CAUSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="input w-24" type="number" min={0}
                           value={r.patients_delayed}
                           onChange={(e)=>setField(r.id,'patients_delayed', Math.max(0, parseInt(e.target.value||'0',10)))} />
                  </td>
                  <td>
                    <input className="input w-24" value={r.provider_initials} onChange={(e)=>setField(r.id,'provider_initials', e.target.value.toUpperCase())} />
                  </td>
                  <td className="text-right">
                    <div className="flex gap-2 justify-end">
                      <button className="btn btn-secondary" onClick={()=>saveRow(r)}>Save</button>
                      <button className="btn btn-danger" onClick={()=>delRow(r.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-600">No entries for this date.</p>}
      </div>

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
