'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser';

// ---------- helpers ----------
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

// ---------- main page ----------
export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'roster' | 'assign' | 'responses'>('roster');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/'); return; }
      const { data: prof, error } = await supabaseBrowser
        .from('profiles')
        .select('is_admin')
        .eq('id', data.session.user.id)
        .single();
      if (error || !prof?.is_admin) {
        router.replace('/dashboard');
        return;
      }
      setIsAdmin(true);
      setReady(true);
    })();
  }, [router]);

  if (!ready) return <p style={{ padding: 16 }}>Loading…</p>;
  if (!isAdmin) return null;

  return (
    <main style={{ padding: 16, display: 'grid', gap: 16 }}>
      <h1>Admin</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setTab('roster')} disabled={tab==='roster'}>Roster</button>
        <button onClick={() => setTab('assign')} disabled={tab==='assign'}>Assignments</button>
        <button onClick={() => setTab('responses')} disabled={tab==='responses'}>Responses</button>
      </div>

      {tab === 'roster' && <RosterManager />}
      {tab === 'assign' && <AssignmentsBuilder />}
      {tab === 'responses' && <ResponsesViewer />}
    </main>
  );
}

// ---------- ROSTER ----------
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
      .upsert({ initials, full_name: fullName, active: true });
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
    <section style={{ display: 'grid', gap: 12 }}>
      <h2>Roster</h2>
      <form onSubmit={addRow} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Initials (e.g., RG)" value={initials}
               onChange={(e) => setInitials(e.target.value.trim().toUpperCase())}
               style={{ padding: 8 }} />
        <input placeholder="Full name" value={fullName}
               onChange={(e) => setFullName(e.target.value)}
               style={{ padding: 8, minWidth: 280 }} />
        <button type="submit">Add / Update</button>
        {msg && <span style={{ color: 'crimson' }}>{msg}</span>}
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th align="left">Initials</th><th align="left">Name</th><th>Active</th><th>Admin</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.initials}>
              <td>{r.initials}</td>
              <td>{r.full_name}</td>
              <td align="center">
                <input type="checkbox" checked={r.active} onChange={(e) => toggle(r.initials, 'active', e.target.checked)} />
              </td>
              <td align="center">
                <input type="checkbox" checked={r.is_admin} onChange={(e) => toggle(r.initials, 'is_admin', e.target.checked)} />
              </td>
              <td align="right">
                <button onClick={() => remove(r.initials)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------- ASSIGNMENTS ----------
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
    <section style={{ display: 'grid', gap: 12 }}>
      <h2>Assignments</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={who} onChange={(e) => setWho(e.target.value)} style={{ padding: 8 }}>
          <option value="">Select provider…</option>
          {roster.map(r => <option key={r.initials} value={r.initials}>{r.initials} — {r.full_name}</option>)}
        </select>
        <button onClick={prevMonth}>&larr; Prev</button>
        <strong>{ymLabel(cursor)}</strong>
        <button onClick={nextMonth}>Next &rarr;</button>
        <button onClick={assignWeekdays} disabled={!who}>Assign Weekdays</button>
        <button onClick={clearMonth} disabled={!who}>Clear Month</button>
      </div>

      {who && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(h => (
            <div key={h} style={{ fontSize: 12, textAlign: 'center', color: '#666' }}>{h}</div>
          ))}
          {days.map(d => {
            const required = requiredSet.has(d);
            const dt = new Date(d);
            let bg = required ? '#fff3cd' : '#f0f0f0';
            return (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                title={d}
                style={{
                  minHeight: 56,
                  padding: 10,
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  background: bg,
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{dt.getDate()}</div>
                <div style={{ fontSize: 12 }}>{required ? 'Required' : 'Not required'}</div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------- RESPONSES ----------
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
      // find the profile_id for these initials
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
    <section style={{ display: 'grid', gap: 12 }}>
      <h2>Responses</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={who} onChange={(e) => setWho(e.target.value)} style={{ padding: 8 }}>
          <option value="">Select provider…</option>
          {roster.map(r => <option key={r.initials} value={r.initials}>{r.initials} — {r.full_name}</option>)}
        </select>
        <button onClick={prevMonth}>&larr; Prev</button>
        <strong>{ymLabel(cursor)}</strong>
        <button onClick={nextMonth}>Next &rarr;</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Date</th>
            <th align="left">Submitted at</th>
            <th align="left">Summary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.survey_date}</td>
              <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ''}</td>
              <td style={{ fontSize: 12 }}>
                {typeof r.answers === 'object' ? JSON.stringify(r.answers) : String(r.answers)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} style={{ color: '#666' }}>No responses.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
