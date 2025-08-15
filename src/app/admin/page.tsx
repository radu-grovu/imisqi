'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser';
import BarChart from '../../components/charts/Bar';
import LineChart from '../../components/charts/Line';

/* ------------------------------ helpers ------------------------------ */
function pad(n: number) { return String(n).padStart(2, '0'); }
function iso(y: number, m: number, d: number) { return `${y}-${pad(m)}-${pad(d)}`; }
function monthDays(year: number, month1to12: number) {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 0);
  const out: string[] = [];
  for (let d = 1; d <= end.getDate(); d++) out.push(iso(year, month1to12, d));
  return out;
}
function ymLabel(date: Date) {
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

type RosterRow = { initials: string; full_name: string; active: boolean; is_admin: boolean };

/* ============================== PAGE ============================== */
export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'roster' | 'assign' | 'responses' | 'analytics'>('roster');

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/'); return; }
      const { data: prof, error } = await supabaseBrowser
        .from('profiles')
        .select('is_admin')
        .eq('id', data.session.user.id)
        .single();
      if (error || !prof?.is_admin) { router.replace('/dashboard'); return; }
      setReady(true);
    })();
  }, [router]);

  if (!ready) return <div className="max-w-5xl mx-auto"><div className="card">Loading…</div></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('roster')}
            className={`btn ${tab==='roster' ? 'btn-primary' : 'btn-secondary'}`}
          >Roster</button>
          <button
            onClick={() => setTab('assign')}
            className={`btn ${tab==='assign' ? 'btn-primary' : 'btn-secondary'}`}
          >Assignments</button>
          <button
            onClick={() => setTab('responses')}
            className={`btn ${tab==='responses' ? 'btn-primary' : 'btn-secondary'}`}
          >Responses</button>
          <button
            onClick={() => setTab('analytics')}
            className={`btn ${tab==='analytics' ? 'btn-primary' : 'btn-secondary'}`}
          >Analytics</button>
        </div>
      </div>

      {tab === 'roster' && <RosterManager />}
      {tab === 'assign' && <AssignmentsBuilder />}
      {tab === 'responses' && <ResponsesViewer />}
      {tab === 'analytics' && <AnalyticsViewer />}
    </div>
  );
}

/* ============================== ROSTER ============================== */
function RosterManager() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [initials, setInitials] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState<string|null>(null);

  async function load() {
    const { data, error } = await supabaseBrowser
      .from('roster')
      .select('initials,full_name,active,is_admin')
      .order('initials');
    if (!error && data) setRows(data as any);
  }
  useEffect(() => { load(); }, []);

  async function addRow(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!initials || !fullName) { setMsg('Initials and full name required.'); return; }
    const { error } = await supabaseBrowser
      .from('roster')
      .upsert({ initials: initials.trim().toUpperCase(), full_name: fullName.trim(), active: true });
    if (error) setMsg(error.message);
    setInitials(''); setFullName('');
    await load();
  }

  async function toggle(initials: string, field: 'active' | 'is_admin', value: boolean) {
    const { error } = await supabaseBrowser
      .from('roster')
      .update({ [field]: value })
      .eq('initials', initials);
    if (!error) await load();
  }

  async function remove(initials: string) {
    if (!confirm(`Remove ${initials}?`)) return;
    const { error } = await supabaseBrowser
      .from('roster')
      .delete()
      .eq('initials', initials);
    if (!error) await load();
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-4">Roster</h2>

      <form onSubmit={addRow} className="grid sm:grid-cols-[140px_1fr_auto] gap-3 mb-4">
        <input
          placeholder="Initials (e.g., RG)"
          value={initials}
          onChange={(e) => setInitials(e.target.value)}
          className="input"
        />
        <input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input"
        />
        <button type="submit" className="btn btn-primary">Add / Update</button>
      </form>
      {msg && <p className="text-sm text-red-600 mb-3">{msg}</p>}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Initials</th>
              <th>Name</th>
              <th>Active</th>
              <th>Admin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.initials}>
                <td>{r.initials}</td>
                <td>{r.full_name}</td>
                <td><input type="checkbox" checked={r.active} onChange={(e) => toggle(r.initials, 'active', e.target.checked)} /></td>
                <td><input type="checkbox" checked={r.is_admin} onChange={(e) => toggle(r.initials, 'is_admin', e.target.checked)} /></td>
                <td className="text-right">
                  <button onClick={() => remove(r.initials)} className="btn btn-secondary">Remove</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="text-sm text-gray-500">No roster entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ============================ ASSIGNMENTS ============================ */
function AssignmentsBuilder() {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [who, setWho] = useState<string>('');
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [requiredSet, setRequiredSet] = useState<Set<string>>(new Set());
  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;
  const days = useMemo(() => monthDays(year, month), [year, month]);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser
        .from('roster')
        .select('initials,full_name,active,is_admin')
        .eq('active', true)
        .order('initials');
      setRoster((data as any) || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!who) { setRequiredSet(new Set()); return; }
      const start = days[0], end = days[days.length - 1];
      const { data } = await supabaseBrowser
        .from('assignments')
        .select('survey_date')
        .eq('initials', who)
        .gte('survey_date', start)
        .lte('survey_date', end);
      const set = new Set<string>();
      for (const row of (data || [])) set.add(String(row.survey_date));
      setRequiredSet(set);
    })();
  }, [who, days]);

  function prevMonth() { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }
  function nextMonth() { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }

  async function toggleDay(dayIso: string) {
    if (!who) return;
    const has = requiredSet.has(dayIso);
    if (has) {
      await supabaseBrowser.from('assignments').delete()
        .eq('initials', who).eq('survey_date', dayIso);
      const s = new Set(requiredSet); s.delete(dayIso); setRequiredSet(s);
    } else {
      await supabaseBrowser.from('assignments').upsert({
        initials: who, survey_date: dayIso, required: true
      });
      const s = new Set(requiredSet); s.add(dayIso); setRequiredSet(s);
    }
  }

  async function assignWeekdays() {
    if (!who) return;
    const weekdayIsos = days.filter(d => {
      const wd = new Date(d).getDay(); // 0 Sun .. 6 Sat
      return wd >= 1 && wd <= 5;
    });
    const rows = weekdayIsos.map(d => ({ initials: who, survey_date: d, required: true }));
    await supabaseBrowser.from('assignments').upsert(rows);
    setRequiredSet(new Set([...requiredSet, ...weekdayIsos]));
  }

  async function clearMonth() {
    if (!who) return;
    await supabaseBrowser.from('assignments')
      .delete()
      .eq('initials', who)
      .gte('survey_date', days[0])
      .lte('survey_date', days[days.length - 1]);
    setRequiredSet(new Set());
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Assignments</h2>
        <div className="flex gap-2">
          <button onClick={assignWeekdays} disabled={!who} className="btn btn-secondary">Assign Weekdays</button>
          <button onClick={clearMonth} disabled={!who} className="btn btn-secondary">Clear Month</button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <select value={who} onChange={(e) => setWho(e.target.value)} className="input max-w-xs">
          <option value="">Select provider…</option>
          {roster.map(r => <option key={r.initials} value={r.initials}>{r.initials} — {r.full_name}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={prevMonth} className="btn btn-secondary">&larr; Prev</button>
          <span className="text-sm font-medium">{ymLabel(cursor)}</span>
          <button onClick={nextMonth} className="btn btn-secondary">Next &rarr;</button>
        </div>
      </div>

      {who && (
        <div className="grid grid-cols-7 gap-2">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(h => (
            <div key={h} className="text-center text-xs text-gray-600">{h}</div>
          ))}
          {days.map(d => {
            const required = requiredSet.has(d);
            const dt = new Date(d);
            const bg = required ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200';
            return (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                title={d}
                className={`h-20 border rounded-md ${bg} text-sm hover:shadow-soft`}
              >
                <div className="font-semibold">{dt.getDate()}</div>
                <div className="text-xs">{required ? 'Required' : 'Optional'}</div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ============================= RESPONSES ============================= */
function ResponsesViewer() {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [who, setWho] = useState<string>('');
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [rows, setRows] = useState<any[]>([]);
  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;
  const start = iso(year, month, 1);
  const end = iso(year, month, new Date(year, month, 0).getDate());

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser
        .from('roster')
        .select('initials,full_name,active')
        .eq('active', true)
        .order('initials');
      setRoster((data as any) || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!who) { setRows([]); return; }
      const { data: prof } = await supabaseBrowser
        .from('profiles')
        .select('id')
        .eq('initials', who)
        .maybeSingle();

      if (!prof?.id) { setRows([]); return; }

      const { data } = await supabaseBrowser
        .from('responses')
        .select('survey_date, submitted_at, answers')
        .eq('profile_id', prof.id)
        .gte('survey_date', start)
        .lte('survey_date', end)
        .order('survey_date');

      setRows((data as any) || []);
    })();
  }, [who, start, end]);

  function prevMonth() { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }
  function nextMonth() { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Responses</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn btn-secondary">&larr; Prev</button>
          <span className="text-sm font-medium">{ymLabel(cursor)}</span>
          <button onClick={nextMonth} className="btn btn-secondary">Next &rarr;</button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <select value={who} onChange={(e) => setWho(e.target.value)} className="input max-w-xs">
          <option value="">Select provider…</option>
          {roster.map(r => <option key={r.initials} value={r.initials}>{r.initials} — {r.full_name}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Submitted at</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.survey_date}</td>
                <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ''}</td>
                <td className="text-xs">{typeof r.answers === 'object' ? JSON.stringify(r.answers) : String(r.answers)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="text-sm text-gray-500">No responses.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ========================= ANALYTICS & EXPORT ========================= */
type FlatRow = {
  survey_date: string;
  initials: string;
  patient_label: string;
  reason_category: string | null;
  reason_detail: string | null;
  comment: string | null;
  total_delayed: number | null;
};

function parseAnswers(ans: any): {
  total_delayed: number;
  patients: Array<{ label?: string; reason?: string; reason_category?: string; reason_detail?: string; comment?: string }>;
  general_comments: string | null;
} {
  if (!ans || typeof ans !== 'object') return { total_delayed: 0, patients: [], general_comments: null };
  const total = typeof ans.total_delayed === 'number' ? ans.total_delayed : (Array.isArray(ans.patients) ? ans.patients.length : 0);
  return {
    total_delayed: total,
    patients: Array.isArray(ans.patients) ? ans.patients : [],
    general_comments: (typeof ans.general_comments === 'string' && ans.general_comments.trim()) ? ans.general_comments : null,
  };
}
function toCSV(rows: FlatRow[]): string {
  const headers = ['survey_date','initials','patient_label','reason_category','reason_detail','comment','total_delayed'];
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([r.survey_date, r.initials, r.patient_label, r.reason_category ?? '', r.reason_detail ?? '', r.comment ?? '', r.total_delayed ?? ''].map(escape).join(','));
  }
  return lines.join('\n');
}

function AnalyticsViewer() {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [who, setWho] = useState<string>(''); // optional filter
  const [start, setStart] = useState<string>(() => {
    const d = new Date(); d.setDate(1);
    return iso(d.getFullYear(), d.getMonth()+1, 1);
  });
  const [end, setEnd] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth()+1, 0);
    return iso(d.getFullYear(), d.getMonth()+1, d.getDate());
  });
  const [loading, setLoading] = useState(false);
  const [flat, setFlat] = useState<FlatRow[]>([]);
  const [summary, setSummary] = useState<{ totalPatients: number; responsesCount: number; avgPerResponse: number; reasons: Record<string, number> }>({
    totalPatients: 0, responsesCount: 0, avgPerResponse: 0, reasons: {}
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser
        .from('roster')
        .select('initials,full_name,active')
        .order('initials');
      setRoster((data as any) || []);
    })();
  }, []);

  async function run() {
    setLoading(true);
    try {
      // 1) Map profile IDs -> initials
      let profQuery = supabaseBrowser.from('profiles').select('id, initials');
      if (who) profQuery = profQuery.eq('initials', who);
      const { data: profs, error: profErr } = await profQuery;
      if (profErr) { setFlat([]); return; }
      const idToInitials = new Map<string,string>();
      for (const p of (profs || [])) if (p.id && p.initials) idToInitials.set(p.id, p.initials);
      if (idToInitials.size === 0) { setFlat([]); setSummary({ totalPatients:0, responsesCount:0, avgPerResponse:0, reasons:{} }); return; }

      // 2) Pull responses
      const ids = Array.from(idToInitials.keys());
      const { data: resps, error: respErr } = await supabaseBrowser
        .from('responses')
        .select('profile_id, survey_date, answers')
        .gte('survey_date', start)
        .lte('survey_date', end)
        .in('profile_id', ids);

      if (respErr) { setFlat([]); return; }

      // 3) Flatten
      const flatRows: FlatRow[] = [];
      let totalPatients = 0;
      let responsesCount = 0;
      const reasonCounts: Record<string, number> = {}; // "Category — Detail"

      for (const r of (resps || [])) {
        const initials = idToInitials.get(r.profile_id) || '';
        const parsed = parseAnswers(r.answers);
        responsesCount++;

        const patients = parsed.patients.length ? parsed.patients : [];
        totalPatients += patients.length;

        if (patients.length === 0) {
          flatRows.push({
            survey_date: r.survey_date,
            initials,
            patient_label: '',
            reason_category: null,
            reason_detail: null,
            comment: null,
            total_delayed: parsed.total_delayed ?? 0,
          });
        } else {
          patients.forEach((p: any, idx: number) => {
            const cat = (typeof p.reason_category === 'string' && p.reason_category.trim()) ? p.reason_category.trim() : null;
            const detRaw = (typeof p.reason_detail === 'string' && p.reason_detail.trim()) ? p.reason_detail.trim() : null;
            const fallback = (typeof p.reason === 'string' && p.reason.trim()) ? p.reason.trim() : null;

            let reasonCategory = cat;
            let reasonDetail = detRaw;

            if (!reasonCategory && fallback) {
              const parts = fallback.split('—').map((s: string) => s.trim());
              if (parts.length >= 2) {
                reasonCategory = parts[0] || null;
                reasonDetail = parts.slice(1).join(' — ') || null;
              } else {
                reasonCategory = 'Unspecified';
                reasonDetail = fallback;
              }
            }

            const key = `${reasonCategory ?? 'Unspecified'} — ${reasonDetail ?? 'Unspecified'}`;
            reasonCounts[key] = (reasonCounts[key] || 0) + 1;

            flatRows.push({
              survey_date: r.survey_date,
              initials,
              patient_label: p?.label || `Patient ${idx+1}`,
              reason_category: reasonCategory,
              reason_detail: reasonDetail,
              comment: p?.comment ?? null,
              total_delayed: parsed.total_delayed ?? patients.length,
            });
          });
        }
      }

      const avgPerResponse = responsesCount ? +(totalPatients / responsesCount).toFixed(2) : 0;

      setFlat(flatRows.sort((a,b) => a.survey_date.localeCompare(b.survey_date) || a.initials.localeCompare(b.initials)));
      setSummary({ totalPatients, responsesCount, avgPerResponse, reasons: reasonCounts });
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const csv = toCSV(flat);
    const label = who ? `_${who}` : '';
    const file = `survey_export_${start}_to_${end}${label}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file; a.click();
    URL.revokeObjectURL(url);
  }

  // chart data
  const topReasons = useMemo(() => {
    return Object.entries(summary.reasons)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 10)
      .map(([k,v]) => ({ label: k, value: v }));
  }, [summary.reasons]);

  const byDate = useMemo(() => {
    const by: Record<string, number> = {};
    flat.forEach(r => { by[r.survey_date] = (by[r.survey_date] || 0) + 1; });
    return Object.entries(by)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([d, v]) => ({ x: d.slice(5), y: v })); // MM-DD
  }, [flat]);

  return (
    <section className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Analytics & Export</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <div className="mb-1">Start</div>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className="input"/>
          </label>
          <label className="text-sm">
            <div className="mb-1">End</div>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="input"/>
          </label>
          <label className="text-sm">
            <div className="mb-1">Provider</div>
            <select value={who} onChange={(e) => setWho(e.target.value)} className="input min-w-[14rem]">
              <option value="">All providers</option>
              {roster.map(r => <option key={r.initials} value={r.initials}>{r.initials} — {r.full_name}</option>)}
            </select>
          </label>
          <div className="ml-auto flex gap-2">
            <button onClick={run} disabled={loading} className="btn btn-primary">
              {loading ? 'Running…' : 'Run'}
            </button>
            <button onClick={exportCSV} disabled={!flat.length} className="btn btn-secondary">
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <div className="card p-4">
            <div className="text-xs text-gray-600">Total patients delayed</div>
            <div className="text-2xl font-semibold">{summary.totalPatients}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-600">Responses counted</div>
            <div className="text-2xl font-semibold">{summary.responsesCount}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-600">Avg delayed / response</div>
            <div className="text-2xl font-semibold">{summary.avgPerResponse}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Top reasons (Category — Detail)</h3>
            <span className="text-xs text-gray-500">Top 10</span>
          </div>
          {topReasons.length ? (
            <BarChart data={topReasons} horizontal />
          ) : (
            <p className="text-sm text-gray-500">Run a range to see data.</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Responses over time</h3>
            <span className="text-xs text-gray-500">per day</span>
          </div>
          {byDate.length ? (
            <LineChart data={byDate} />
          ) : (
            <p className="text-sm text-gray-500">Run a range to see data.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Patient-level rows ({flat.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Initials</th>
                <th>Patient</th>
                <th>Reason category</th>
                <th>Detail</th>
                <th>Comment</th>
                <th className="text-right">Total Delayed</th>
              </tr>
            </thead>
            <tbody>
              {flat.map((r, i) => (
                <tr key={i}>
                  <td>{r.survey_date}</td>
                  <td>{r.initials}</td>
                  <td>{r.patient_label}</td>
                  <td>{r.reason_category ?? ''}</td>
                  <td>{r.reason_detail ?? ''}</td>
                  <td className="max-w-[380px] truncate">{r.comment ?? ''}</td>
                  <td className="text-right">{r.total_delayed ?? ''}</td>
                </tr>
              ))}
              {!flat.length && (
                <tr><td colSpan={7} className="text-sm text-gray-500">No data. Choose a date range and click Run.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
