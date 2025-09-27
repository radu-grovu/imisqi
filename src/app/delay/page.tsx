'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

// --- Cause → Subcause dictionary (adjust freely) ---
const CAUSES: Record<string, string[]> = {
  'Imaging delay': ['MRI','CT','Ultrasound','X-ray','IR','Scheduling','Result turnaround','Other'],
  'Consult delay': ['Cardiology','GI','Neurology','Surgery','Psychiatry','Hospitalist','Other'],
  'Pharmacy processing': ['Med-to-Bed','Prior auth','Dispensing','Verification','Other'],
  'Bed not ready': ['EVS/Cleaning','Bed assignment','Transport to bed','Other'],
  'Placement/Disposition': ['SNF placement','Home health','DME','Paperwork pending','Insurance auth','Other'],
  'Transport': ['Internal transport','External transfer','Ambulance','Porter/wheelchair','Other'],
  'Labs/Path/Micro': ['Bloodwork pending','Micro pending','Pathology pending','Other'],
  'Other': ['Other']
};

type Row = {
  id?: number;
  event_date: string;             // YYYY-MM-DD
  cause: string;
  subcause: string;
  patient_key: string;            // HIPAA-safe short tag (e.g., last 4 MRN)
  // keep patients_delayed under the hood for analytics (fixed to 1)
  patients_delayed?: number;
};

type DayStatus = 'none' | 'recorded' | 'no_delays';

function formatDate(d: Date) { return d.toISOString().slice(0,10); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function addDays(d: Date, n: number) { const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function isSameDate(a: Date, b: Date){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

export default function DelaysPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [myInitials, setMyInitials] = useState<string>('');
  const [monthAnchor, setMonthAnchor] = useState<Date>(new Date()); // current month
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, DayStatus>>({});
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  // session + profile
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/auth/login'); return; }
      setUserId(data.session.user.id);
      const { data: prof } = await supabaseBrowser.from('profiles').select('initials').eq('id', data.session.user.id).single();
      setMyInitials(prof?.initials ?? '');
      // initial load
      await refreshMonth(data.session.user.id, monthAnchor);
      await loadDay(data.session.user.id, selectedDate);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refresh statuses whenever month changes
  useEffect(() => {
    (async () => {
      if (!userId) return;
      await refreshMonth(userId, monthAnchor);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthAnchor, userId]);

  async function refreshMonth(uid: string, anchor: Date) {
    const a = startOfMonth(anchor);
    const z = endOfMonth(anchor);
    const from = formatDate(a);
    const to   = formatDate(z);

    // delays present?
    const d1 = supabaseBrowser
      .from('discharge_surveys')
      .select('event_date', { count: 'exact', head: false })
      .eq('user_id', uid)
      .gte('event_date', from)
      .lte('event_date', to);

    // explicit "no delays"?
    const d2 = supabaseBrowser
      .from('discharge_no_delays')
      .select('event_date', { count: 'exact', head: false })
      .eq('user_id', uid)
      .gte('event_date', from)
      .lte('event_date', to);

    const [{ data: delays, error: e1 }, { data: none, error: e2 }] = await Promise.all([d1, d2]);
    if (e1 || e2) { setMsg((e1||e2)?.message ?? 'Failed loading month'); return; }

    const map: Record<string, DayStatus> = {};
    (delays ?? []).forEach((r:any) => { map[r.event_date] = 'recorded'; });
    (none ?? []).forEach((r:any) => {
      if (!map[r.event_date]) map[r.event_date] = 'no_delays';
    });
    setStatusMap(map);
  }

  async function loadDay(uid: string, date: string) {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('discharge_surveys')
      .select('id, event_date, cause, subcause, patient_key, patients_delayed')
      .eq('user_id', uid)
      .eq('event_date', date)
      .order('id', { ascending: true });
    if (error) { setMsg(error.message); setRows([]); setLoading(false); return; }
    setRows(((data ?? []) as any[]).map(r => ({
      id: r.id,
      event_date: r.event_date,
      cause: r.cause,
      subcause: r.subcause,
      patient_key: r.patient_key,
      patients_delayed: r.patients_delayed ?? 1
    })));
    setLoading(false);
  }

  function nextMonth() { setMonthAnchor(addDays(endOfMonth(monthAnchor), 1)); }
  function prevMonth() { setMonthAnchor(addDays(startOfMonth(monthAnchor), -1)); }

  function calendarDays(): Date[] {
    const start = startOfMonth(monthAnchor);
    const end = endOfMonth(monthAnchor);
    const firstCell = addDays(start, -((start.getDay()+6)%7)); // Mon-start grid
    const lastCell = addDays(end, (7-1 - ((end.getDay()+6)%7)));
    const days: Date[] = [];
    for (let d = new Date(firstCell); d <= lastCell; d = addDays(d,1)) days.push(new Date(d));
    return days;
  }

  async function selectDay(d: Date) {
    const dstr = formatDate(d);
    setSelectedDate(dstr);
    if (userId) { await loadDay(userId, dstr); }
  }

  async function addRow() {
    const cause = Object.keys(CAUSES)[0];
    const sub = CAUSES[cause][0];
    setRows(prev => [...prev, { event_date: selectedDate, cause, subcause: sub, patient_key: '', patients_delayed: 1 }]);
    // If there was a "no delays" mark, remove it proactively
    if (statusMap[selectedDate] === 'no_delays') {
      await removeNoDelaysMark(selectedDate);
      setStatusMap(prev => ({ ...prev, [selectedDate]: 'none' }));
    }
  }

  function setField(id: number | undefined, field: keyof Row, value: any) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  async function saveRow(r: Row) {
    if (!userId) return;
    const payload = {
      event_date: r.event_date,
      cause: r.cause,
      subcause: r.subcause,
      patient_key: r.patient_key,
      patients_delayed: 1  // per-patient row
    };
    // Upsert: if this row already exists (id), update; else insert
    if (r.id) {
      const { error } = await supabaseBrowser
        .from('discharge_surveys')
        .update(payload)
        .eq('id', r.id);
      if (error) { setMsg(error.message); return; }
    } else {
      const { data, error } = await supabaseBrowser
        .from('discharge_surveys')
        .insert(payload)
        .select('id')
        .single();
      if (error) { setMsg(error.message); return; }
      // write back id
      setRows(prev => prev.map(x => (x === r ? { ...r, id: data?.id } : x)));
    }
    // Mark calendar as recorded for the day
    setStatusMap(prev => ({ ...prev, [selectedDate]: 'recorded' }));
    setMsg('Saved.');
    setTimeout(()=>setMsg(null), 1200);
  }

  async function deleteRow(r: Row) {
    if (!r.id) { setRows(prev => prev.filter(x => x !== r)); return; }
    if (!confirm('Delete this delay entry?')) return;
    const { error } = await supabaseBrowser.from('discharge_surveys').delete().eq('id', r.id);
    if (error) { setMsg(error.message); return; }
    setRows(prev => prev.filter(x => x.id !== r.id));
    // If no rows remain and no "no_delays" mark, clear day status
    setTimeout(() => {
      if (!rows.length) {
        setStatusMap(prev => ({ ...prev, [selectedDate]: prev[selectedDate]==='no_delays' ? 'no_delays' : 'none' }));
      }
    }, 0);
  }

  async function markNoDelays() {
    if (!userId) return;
    if (rows.length) {
      const proceed = confirm('Marking “No delays” will delete all delay entries for this day. Continue?');
      if (!proceed) return;
      // delete day’s rows first
      const { error: delErr } = await supabaseBrowser
        .from('discharge_surveys')
        .delete()
        .eq('event_date', selectedDate)
        .eq('user_id', userId);
      if (delErr) { setMsg(delErr.message); return; }
      setRows([]);
    }
    // insert or upsert "no delays"
    const { error } = await supabaseBrowser
      .from('discharge_no_delays')
      .upsert({ event_date: selectedDate, user_id: userId }, { onConflict: 'user_id,event_date' });
    if (error) { setMsg(error.message); return; }
    setStatusMap(prev => ({ ...prev, [selectedDate]: 'no_delays' }));
    setMsg('Recorded “No delays”.');
    setTimeout(()=>setMsg(null), 1200);
  }

  async function removeNoDelaysMark(dateStr: string) {
    if (!userId) return;
    await supabaseBrowser
      .from('discharge_no_delays')
      .delete()
      .eq('event_date', dateStr)
      .eq('user_id', userId);
  }

  // Simple field validation
  function patientKeyValid(s: string) {
    const t = (s || '').trim();
    return t.length >= 3 && t.length <= 12 && /^[A-Za-z0-9-]+$/.test(t);
  }

  const days = useMemo(() => calendarDays(), [monthAnchor, statusMap]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Discharge Delays</h1>

      {/* Calendar */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <button className="btn btn-secondary" onClick={prevMonth}>&larr; Prev</button>
          <div className="font-medium">
            {monthAnchor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <button className="btn btn-secondary" onClick={nextMonth}>Next &rarr;</button>
        </div>

        <div className="grid grid-cols-7 text-xs font-medium text-gray-600 mb-1">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d} className="p-1 text-center">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d, idx) => {
            const inMonth = d.getMonth() === monthAnchor.getMonth();
            const dstr = formatDate(d);
            const status = statusMap[dstr] ?? 'none';
            const isToday = isSameDate(d, new Date());
            const isSelected = dstr === selectedDate;
            const bg = status === 'recorded' ? 'bg-green-100'
                     : status === 'no_delays' ? 'bg-emerald-50'
                     : 'bg-white';
            const br = isSelected ? 'border-blue-600' : 'border-gray-200';
            const txt = inMonth ? 'text-gray-900' : 'text-gray-400';
            return (
              <button
                key={idx}
                className={`h-16 rounded border ${br} ${bg} ${txt} flex flex-col items-center justify-center hover:bg-gray-50`}
                onClick={() => selectDay(d)}
                title={dstr}
              >
                <div className={`text-sm ${isToday ? 'font-bold' : ''}`}>{d.getDate()}</div>
                <div className="text-[10px]">
                  {status === 'recorded' ? '✔ recorded'
                    : status === 'no_delays' ? '✔ no delays'
                    : ''}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Entries for selected day */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">Entries for {selectedDate}</h2>
          <div className="ml-auto flex gap-2">
            <button className="btn btn-secondary" onClick={addRow}>Add patient delay</button>
            <button className="btn btn-ghost" onClick={async ()=>{ await removeNoDelaysMark(selectedDate); setStatusMap(prev=>({ ...prev, [selectedDate]:'none' })); }}>
              Clear “no delays”
            </button>
            <button className="btn btn-primary" onClick={markNoDelays}>I have no delays today</button>
          </div>
        </div>

        {loading ? <p>Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Cause</th>
                  <th>Sub-cause</th>
                  <th>Patient key <span className="text-xs text-gray-500">(e.g., last 4 MRN)</span></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="text-sm text-gray-600">No entries yet. Add one, or mark “No delays”.</td></tr>
                )}
                {rows.map(r => {
                  const subs = CAUSES[r.cause] ?? ['Other'];
                  const validKey = patientKeyValid(r.patient_key);
                  return (
                    <tr key={r.id ?? Math.random()}>
                      <td>
                        <select className="input min-w-[12rem]"
                          value={r.cause}
                          onChange={(e)=>{
                            const cause = e.target.value;
                            const firstSub = (CAUSES[cause] ?? ['Other'])[0];
                            setField(r.id, 'cause', cause);
                            setField(r.id, 'subcause', firstSub);
                          }}>
                          {Object.keys(CAUSES).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="input min-w-[12rem]"
                          value={r.subcause}
                          onChange={(e)=>setField(r.id, 'subcause', e.target.value)}>
                          {subs.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <input className={`input min-w-[10rem] ${validKey?'':'border-red-400'}`}
                               placeholder="e.g., MRN-1234"
                               value={r.patient_key}
                               onChange={(e)=>setField(r.id, 'patient_key', e.target.value.trim())} />
                        {!validKey && <div className="text-xs text-red-600 mt-1">3–12 letters/numbers</div>}
                      </td>
                      <td className="text-right">
                        <div className="flex gap-2 justify-end">
                          <button className="btn btn-secondary" disabled={!validKey} onClick={()=>saveRow(r)} title="Save">Save</button>
                          <button className="btn btn-danger" onClick={()=>deleteRow(r)} title="Delete">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </div>
  );
}
