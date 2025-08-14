'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../lib/supabaseBrowser';
import { useRouter } from 'next/navigation';

type DayCell = {
  iso: string;   // YYYY-MM-DD
  day: number;   // 1..31
  inMonth: boolean;
};

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Build a 6x7 grid (Sun..Sat) covering the month, including leading/trailing days.
function buildGrid(base: Date): DayCell[] {
  const start = monthStart(base);
  const end = monthEnd(base);

  const startWeekday = start.getDay(); // 0=Sun .. 6=Sat
  const firstGridDate = new Date(start);
  firstGridDate.setDate(start.getDate() - startWeekday); // back to Sunday

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(firstGridDate);
    d.setDate(firstGridDate.getDate() + i);
    const inMonth = d.getMonth() === base.getMonth();
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    cells.push({ iso, day: d.getDate(), inMonth });
  }
  return cells;
}

export default function CompletionCalendar() {
  const router = useRouter();
  const [today] = useState(() => {
    const d = new Date();
    // normalize to local date at midnight
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [cursor, setCursor] = useState<Date>(() => new Date(today)); // viewing month
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const start = monthStart(cursor);
  const end = monthEnd(cursor);

  const startIso = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(1)}`;
  const endIso = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

  const grid = useMemo(() => buildGrid(cursor), [cursor]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);

      // ensure user is logged in; page should already be protected, but double-check
      const { data: sess } = await supabaseBrowser.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        setError('Not signed in.');
        setLoading(false);
        return;
      }

      // fetch all survey_dates for this month for this user
      const { data, error } = await supabaseBrowser
        .from('responses')
        .select('survey_date')
        .gte('survey_date', startIso)
        .lte('survey_date', endIso);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const set = new Set<string>();
      for (const row of data || []) {
        // survey_date comes back as 'YYYY-MM-DD'
        if (row.survey_date) set.add(String(row.survey_date));
      }
      if (mounted) {
        setCompleted(set);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [startIso, endIso]);

  function prevMonth() {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() - 1);
    setCursor(d);
  }
  function nextMonth() {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + 1);
    setCursor(d);
  }

  function goToDay(iso: string) {
    router.push(`/survey/${iso}`);
  }

  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={prevMonth}>&larr; Prev</button>
        <div style={{ fontWeight: 600 }}>{monthLabel}</div>
        <button type="button" onClick={nextMonth}>Next &rarr;</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 14 }}>
          <span><span style={swatch('#e5e5e5')}/> future</span>
          <span><span style={swatch('#f8d7da')}/> missing</span>
          <span><span style={swatch('#d1e7dd')}/> submitted</span>
          <span><span style={swatch('#fff3cd')}/> today</span>
        </div>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 6
      }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((w) => (
          <div key={w} style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>{w}</div>
        ))}
        {grid.map((c) => {
          const cellDate = new Date(c.iso);
          const isToday = cellDate.getTime() === today.getTime();
          const isFuture = cellDate > today;
          const isDone = completed.has(c.iso);

          // colors
          let bg = '#fff';
          if (!c.inMonth) bg = '#fafafa';
          else if (isFuture) bg = '#e5e5e5';
          else if (isDone) bg = '#d1e7dd';
          else bg = '#f8d7da';

          if (isToday) bg = '#fff3cd'; // highlight today

          return (
            <button
              key={c.iso}
              type="button"
              onClick={() => goToDay(c.iso)}
              title={c.iso}
              style={{
                background: bg,
                border: '1px solid #ddd',
                borderRadius: 6,
                padding: '12px 6px',
                minHeight: 56,
                cursor: 'pointer',
                opacity: c.inMonth ? 1 : 0.6,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{c.day}</div>
              {c.inMonth && (
                <div style={{ fontSize: 12 }}>
                  {isFuture ? '—' : (isDone ? 'Submitted' : 'Missing')}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function swatch(color: string): React.CSSProperties {
  return {
    display: 'inline-block',
    width: 12,
    height: 12,
    background: color,
    border: '1px solid #ccc',
    verticalAlign: 'middle',
    marginRight: 6,
  } as React.CSSProperties;
}
