'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

// --- Cause → Subcause dictionary (adjust as needed) ---
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
  event_date: string;   // YYYY-MM-DD
  patient_key: string;  // HIPAA-safe short tag
  cause: string;
  subcause: string;
  patients_delayed?: number;
};
type DayStatus = 'none' | 'recorded' | 'no_delays';

function formatDate(d: Date) { return d.toISOString().slice(0,10); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function isSameDate(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() &&
         a.getMonth()===b.getMonth() &&
         a.getDate()===b.getDate();
}

export default function DelaysPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string|null>(null);
  const [monthAnchor, setMonthAnchor] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, DayStatus>>({});
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  // On mount: check session and load initial data
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { 
        router.replace('/auth/login'); 
        return; 
      }
      setUserId(data.session.user.id);
      await refreshMonth(data.session.user.id, monthAnchor);
      await loadDay(data.session.user.id, selectedDate);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload month status when monthAnchor or user changes
  useEffect(() => {
    (async () => {
      if (!userId) return;
      await refreshMonth(userId, monthAnchor);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthAnchor, userId]);

  async function refreshMonth(uid: string, anchor: Date) {
    const from = formatDate(startOfMonth(anchor));
    const to   = formatDate(endOfMonth(anchor));
    const [{ data: delays, error: e1 }, { data: none, error: e2 }] = await Promise.all([
      supabaseBrowser.from('discharge_surveys')
        .select('event_date', { count: 'exact' })
        .eq('user_id', uid)
        .gte('event_date', from)
        .lte('event_date', to),
      supabaseBrowser.from('discharge_no_delays')
        .select('event_date', { count: 'exact' })
        .eq('user_id', uid)
        .gte('event_date', from)
        .lte('event_date', to)
    ]);
    if (e1 || e2) { 
      setMsg((e1 || e2)?.message ?? 'Failed loading month'); 
      return; 
    }
    const map: Record<string, DayStatus> = {};
    (delays ?? []).forEach((r: any) => { map[r.event_date] = 'recorded'; });
    (none ?? []).forEach((r: any) => { 
      if (!map[r.event_date]) map[r.event_date] = 'no_delays'; 
    });
    setStatusMap(map);
  }

  async function loadDay(uid: string, date: string) {
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('discharge_surveys')
      .select('id, event_date, patient_key, cause, subcause, patients_delayed')
      .eq('user_id', uid)
      .eq('event_date', date)
      .order('id', { ascending: true });
    if (error) { 
      setMsg(error.message); 
      setRows([]); 
      setLoading(false); 
      return; 
    }
    setRows((data ?? []).map((r: any) => ({
      id: r.id,
      event_date: r.event_date,
      patient_key: r.patient_key ?? '',
      cause: r.cause,
      subcause: r.subcause,
      patients_delayed: r.patients_delayed ?? 1
    })));
    setLoading(false);
  }

  function nextMonth() { 
    setMonthAnchor(addDays(endOfMonth(monthAnchor), 1)); 
  }
  function prevMonth() { 
    setMonthAnchor(addDays(startOfMonth(monthAnchor), -1)); 
  }

  function calendarDays(): Date[] {
    const start = startOfMonth(monthAnchor);
    const end = endOfMonth(monthAnchor);
    const firstCell = addDays(start, -((start.getDay()+6)%7)); // start on Monday
    const lastCell = addDays(end, (6 - ((end.getDay()+6)%7)));
    const days: Date[] = [];
    for (let d = new Date(firstCell); d <= lastCell; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    return days;
  }

  async function selectDay(d: Date) {
    const dstr = formatDate(d);
    setSelectedDate(dstr);
    if (userId) {
      await loadDay(userId, dstr);
    }
  }

  async function markNoDelays() {
    if (!userId) return;
    const { error } = await supabaseBrowser
      .from('discharge_no_delays')
      .insert({ user_id: userId, event_date: selectedDate });
    if (error) {
      setMsg(error.message);
    } else {
      // Mark day as having no delays
      setStatusMap(prev => ({ ...prev, [selectedDate]: 'no_delays' }));
      setMsg('Marked no delays.');
      setRows([]);  // clear any entries in UI
    }
  }

  async function removeNoDelaysMark(date: string) {
    if (!userId) return;
    await supabaseBrowser.from('discharge_no_delays')
      .delete()
      .eq('user_id', userId)
      .eq('event_date', date);
    // (Any error is handled by refreshMonth on next load; statusMap will be updated below)
  }

  function setFieldAt(index: number, field: keyof Row, value: any) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  async function addRow() {
    // Start a new delay entry with default cause/subcause
    const cause = Object.keys(CAUSES)[0];
    const subcause = CAUSES[cause][0];
    setRows(prev => [
      ...prev, 
      { event_date: selectedDate, patient_key: '', cause, subcause, patients_delayed: 1 }
    ]);
    // If a "no delays" mark existed for this date, remove it
    if (statusMap[selectedDate] === 'no_delays') {
      await removeNoDelaysMark(selectedDate);
      setStatusMap(prev => ({ ...prev, [selectedDate]: 'none' }));
    }
  }

  async function saveRow(index: number, r: Row) {
    if (!userId) return;
    const payload = {
      event_date: r.event_date,
      patient_key: (r.patient_key ?? '').trim(),
      cause: r.cause,
      subcause: r.subcause,
      patients_delayed: 1
    };
    if (r.id) {
      // Update existing entry
      const { error } = await supabaseBrowser.from('discharge_surveys').update(payload).eq('id', r.id);
      if (error) { 
        setMsg(error.message); 
        return; 
      }
    } else {
      // Insert new entry
      const { data, error } = await supabaseBrowser.from('discharge_surveys').insert(payload).select('id').single();
      if (error) { 
        setMsg(error.message); 
        return; 
      }
      // Attach the new ID to the row in state
      setRows(prev => prev.map((item, i) => i === index ? { ...item, id: data?.id, patient_key: payload.patient_key } : item));
    }
    // Mark the day as having a recorded delay
    setStatusMap(prev => ({ ...prev, [selectedDate]: 'recorded' }));
    setMsg('Saved.');
    setTimeout(() => setMsg(null), 1200);
  }

  async function deleteRow(index: number, r: Row) {
    if (r.id) {
      if (!confirm('Delete this delay entry?')) return;
      const { error } = await supabaseBrowser.from('discharge_surveys').delete().eq('id', r.id);
      if (error) { 
        setMsg(error.message); 
        return; 
      }
    }
    // Remove the entry from state
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    // Adjust day status if no rows remain
    if (newRows.length === 0) {
      setStatusMap(prev => ({ ...prev, [selectedDate]: 'none' }));
    }
  }

  const days = useMemo(() => calendarDays(), [monthAnchor, statusMap]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Discharge Delays</h1>

      {/* Calendar view for the month */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <button className="btn btn-secondary" onClick={prevMonth}>&larr; Prev</button>
          <div className="font-medium">
            {monthAnchor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <button className="btn btn-secondary" onClick={nextMonth}>Next &rarr;</button>
        </div>
        <div className="grid grid-cols-7 text-xs font-medium text-gray-600 mb-1">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="p-1 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, idx) => {
            const inMonth = d.getMonth() === monthAnchor.getMonth();
            const dstr = formatDate(d);
            const status = statusMap[dstr] ?? 'none';
            const isToday = isSameDate(d, new Date());
            const isSelected = dstr === selectedDate;
            const bg = status === 'recorded' 
                        ? 'bg-green-100' 
                        : status === 'no_delays' 
                        ? 'bg-emerald-50' 
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

      {/* Delay entries for the selected day */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">Entries for {selectedDate}</h2>
          <div className="ml-auto flex gap-2">
            <button className="btn btn-secondary" onClick={addRow}>Add patient delay</button>
            {statusMap[selectedDate] === 'no_delays'
              ? <button 
                  className="btn btn-ghost" 
                  onClick={async () => { 
                    await removeNoDelaysMark(selectedDate); 
                    setStatusMap(prev => ({ ...prev, [selectedDate]: 'none' })); 
                  }}
                >
                  Clear “no delays”
                </button>
              : (rows.length === 0 && 
                  <button className="btn btn-primary" onClick={markNoDelays}>
                    I have no delays today
                  </button>
                )
            }
          </div>
        </div>

        {loading ? <p>Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient key <span className="text-xs text-gray-500">(e.g., last4 MRN)</span></th>
                  <th>Cause</th>
                  <th>Sub-cause</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-sm text-gray-600">
                      No entries yet. Add one, or mark “No delays”.
                    </td>
                  </tr>
                )}
                {rows.map((r, index) => {
                  const subs = CAUSES[r.cause] ?? ['Other'];
                  const keyTrim = (r.patient_key ?? '').trim();
                  const validKey = keyTrim.length >= 3 && keyTrim.length <= 12 && /^[A-Za-z0-9-]+$/.test(keyTrim);
                  return (
                    <tr key={r.id ? `row-${r.id}` : `draft-${index}`}>
                      <td>
                        <input
                          className={`input min-w-[10rem] ${validKey || keyTrim.length === 0 ? '' : 'border-red-400'}`}
                          placeholder="e.g., MRN-1234"
                          value={r.patient_key}
                          onChange={(e) => setFieldAt(index, 'patient_key', e.target.value)}
                        />
                        {!validKey && keyTrim.length > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            3–12 letters/numbers/dash
                          </div>
                        )}
                      </td>
                      <td>
                        <select
                          className="input min-w-[12rem]"
                          value={r.cause}
                          onChange={(e) => {
                            const cause = e.target.value;
                            const firstSub = (CAUSES[cause] ?? ['Other'])[0];
                            setFieldAt(index, 'cause', cause);
                            setFieldAt(index, 'subcause', firstSub);
                          }}
                        >
                          {Object.keys(CAUSES).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {r.cause === 'Other' ? (
                          <input
                            className="input min-w-[12rem]"
                            placeholder="Specify sub-cause"
                            maxLength={150}
                            value={r.subcause}
                            onChange={(e) => setFieldAt(index, 'subcause', e.target.value)}
                          />
                        ) : (
                          <select
                            className="input min-w-[12rem]"
                            value={r.subcause}
                            onChange={(e) => setFieldAt(index, 'subcause', e.target.value)}
                          >
                            {subs.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex gap-2 justify-end">
                          <button 
                            className="btn btn-secondary" 
                            disabled={!validKey} 
                            onClick={() => saveRow(index, r)} 
                            title="Save"
                          >
                            Save
                          </button>
                          <button 
                            className="btn btn-danger" 
                            onClick={() => deleteRow(index, r)} 
                            title="Delete"
                          >
                            Delete
                          </button>
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
