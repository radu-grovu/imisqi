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

export default function DelaysPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [myInitials, setMyInitials] = useState<string>('');
  const [date, setDate] = useState<string>(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/auth/login'); return; }
      setUserId(data.session.user.id);
      const { data: prof } = await supabaseBrowser.from('profiles').select('initials').eq('id', data.session.user.id).single();
      setMyInitials(prof?.initials ?? '');
      await load(data.session.user.id, date);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(uid: string, d: string) {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('discharge_surveys')
      .select('id, event_date, provider_initials, cause, patients_delayed')
      .eq('user_id', uid)
      .eq('event_date', d)
      .order('id', { ascending: true });
    if (error) setMsg(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  async function addRow() {
    if (!userId) return;
    const payload = {
      event_date: date,
      provider_initials: myInitials || '??',
      cause: CAUSES[0],
      patients_delayed: 0
    };
    const { data, error } = await supabaseBrowser
      .from('discharge_surveys')
      .insert(payload)
      .select('id, event_date, provider_initials, cause, patients_delayed')
      .single();
    if (error) { setMsg(error.message); return; }
    setRows(prev => [...prev, data as Row]);
  }

  function setField(id:number, field:keyof Row, value:any) {
    setRows(prev => prev.map(r => r.id===id ? { ...r, [field]: value } : r));
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
    setTimeout(()=>setMsg(null), 1200);
  }

  async function delRow(id:number) {
    if (!confirm('Delete this delay record?')) return;
    const { error } = await supabaseBrowser.from('discharge_surveys').delete().eq('id', id);
    if (error) { setMsg(error.message); return; }
    setRows(prev => prev.filter(x => x.id !== id));
  }

  const totalPatients = useMemo(() => rows.reduce((s,r)=>s + (r.patients_delayed||0), 0), [rows]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Discharge Delays</h1>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs mb-1">Date</label>
          <input type="date" className="input" value={date}
            onChange={async (e)=>{ setDate(e.target.value); if (userId) await load(userId, e.target.value); }} />
        </div>
        <button className="btn btn-primary" onClick={addRow}>Add Row</button>
        <div className="ml-auto text-sm text-gray-600">Total patients delayed today: <b>{totalPatients}</b></div>
      </div>

      <div className="card">
        <h2 className="text-lg font-medium mb-2">Your entries for {date}</h2>
        {loading ? <p>Loading…</p> : rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Cause</th><th>Patients</th><th>Provider</th><th></th></tr>
              </thead>
              <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="i i-pencil" title="Edit" />
                      <select className="input" value={r.cause} onChange={(e)=>setField(r.id,'cause', e.target.value)}>
                        {CAUSES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </td>
                  <td>
                    <input className="input w-24" type="number" min={0} value={r.patients_delayed}
                      onChange={(e)=>setField(r.id,'patients_delayed', Math.max(0, parseInt(e.target.value||'0',10)))} />
                  </td>
                  <td>
                    <input className="input w-24" value={r.provider_initials}
                      onChange={(e)=>setField(r.id,'provider_initials', e.target.value.toUpperCase())} />
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary" onClick={()=>saveRow(r)} title="Save">Save</button>
                      <button className="btn btn-danger" onClick={()=>delRow(r.id)} title="Delete">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-600">No entries for this date. Click “Add Row”.</p>}
      </div>

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
