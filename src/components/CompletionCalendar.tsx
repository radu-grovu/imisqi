'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../lib/supabaseBrowser';

function pad(n: number) { return String(n).padStart(2, '0'); }
function iso(y: number, m: number, d: number) { return `${y}-${pad(m)}-${pad(d)}`; }
function monthDays(year: number, month1to12: number) {
  const end = new Date(year, month1to12, 0).getDate(); // last day of month
  const out: string[] = [];
  for (let d = 1; d <= end; d++) out.push(iso(year, month1to12, d));
  return out;
}
function ymLabel(date: Date) {
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

type RespRow = { survey_date: string };
type AssignRow = { survey_date: string };

export default function CompletionCalendar() {
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [profileId, setProfileId] = useState<string | null>(null);
  const [initials, setInitials] = useState<string | null>(null);

  const [responses, setResponses] = useState<Set<string>>(new Set());
  const [required, setRequired] = useState<Set<string>>(new Set());

  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;
  const days = useMemo(() => monthDays(year, month), [year, month]);
  const start = days[0];
  const end = days[days.length - 1];

  // Load session & profile
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      const uid = data.session?.user?.id || null;
      if (!uid) { setReady(true); return; }

      const { data: prof } = await supabaseBrowser
        .from('profiles')
        .select('id, initials')
        .eq('id', uid)
        .single();

      setProfileId(prof?.id ?? null);
      setInitials(prof?.initials ?? null);
      setReady(true);
    })();
  }, []);

  // Load responses for this month (for this user)
  useEffect(() => {
    (async () => {
      if (!profileId || !start || !end) { setResponses(new Set()); return; }
      const { data, error } = await supabaseBrowser
        .from('responses')
        .select('survey_date')
        .eq('profile_id', profileId)
        .gte('survey_date', start)
        .lte('survey_date', end);
      if (error) { setResponses(new Set()); return; }
      const set = new Set<string>();
      for (const r of (data as RespRow[])) set.add(String(r.survey_date));
      setResponses(set);
    })();
  }, [profileId, start, end]);

  // Load assignments for this month (by initials)
  useEffect(() => {
    (async () => {
      if (!initials || !start || !end) { setRequired(new Set()); return; }
      const { data, error } = await supabaseBrowser
        .from('assignments')
        .select('survey_date')
        .eq('initials', initials)
        .gte('survey_date', start)
        .lte('survey_date', end);
      if (error) { setRequired(new Set()); return; }
      const set = new Set<string>();
      for (const r of (data as AssignRow[])) set.add(String(r.survey_date));
      setRequired(set);
    })();
  }, [initials, start, end]);

  function prevMonth() { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }
  function nextMonth() { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }

  if (!ready) return <p>Loading…</p>;

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={prevMonth}>&larr; Prev</button>
        <strong>{ymLabel(cursor)}</strong>
        <button onClick={nextMonth}>Next &rarr;</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(h => (
          <div key={h} style={{ fontSize: 12, textAlign: 'center', color: '#666' }}>{h}</div>
        ))}

        {days.map(d => {
          const hasResponse = responses.has(d);
          const isRequired = required.has(d);

          // color logic
          let bg = '#f0f0f0';          // default gray (not required and no response)
          let label = 'Optional';
          if (isRequired && !hasResponse) { bg = '#ffe5e5'; label = 'Required (missing)'; } // red
          if (hasResponse)             { bg = '#e8f7e8'; label = 'Submitted'; }            // green

          const dt = new Date(d);
          return (
            <a
              key={d}
              href={`/survey/${d}`}
              title={d}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid #ddd',
                borderRadius: 6,
                background: bg,
                minHeight: 64,
                padding: 10,
                display: 'grid',
                alignContent: 'start',
                gap: 4,
              }}
            >
              <div style={{ fontWeight: 700 }}>{dt.getDate()}</div>
              <div style={{ fontSize: 12 }}>{label}</div>
            </a>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: '#555' }}>
        <span style={{ display: 'inline-block', width: 12, height: 12, background: '#e8f7e8', border: '1px solid #ddd', marginRight: 6 }} />
        Submitted
        <span style={{ display: 'inline-block', width: 12, height: 12, background: '#ffe5e5', border: '1px solid #ddd', margin: '0 6px 0 12px' }} />
        Required (missing)
        <span style={{ display: 'inline-block', width: 12, height: 12, background: '#f0f0f0', border: '1px solid #ddd', margin: '0 6px 0 12px' }} />
        Optional
      </div>
    </section>
  );
}
