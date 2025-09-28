'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Row = {
  event_date: string;            // YYYY-MM-DD
  provider_initials: string;
  cause: string;
  subcause: string;
  patient_key: string;
  patients_delayed: number;
};

type Provider = { initials: string; full_name: string | null };

function todayStr() { return new Date().toISOString().slice(0,10); }
function addDays(d: string, days: number) {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0,10);
}

export default function AdminDischargePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [startDate, setStartDate] = useState(addDays(todayStr(), -30));
  const [endDate, setEndDate] = useState(todayStr());
  const [provider, setProvider] = useState<string>('ALL');

  const [rows, setRows] = useState<Row[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Gate: admin only
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/auth/login'); return; }
      const { data: prof, error } = await supabaseBrowser
        .from('profiles')
        .select('is_admin')
        .eq('id', data.session.user.id)
        .single();
      if (error) { setMsg(error.message); setIsAdmin(false); return; }
      setIsAdmin(!!prof?.is_admin);
      if (!prof?.is_admin) return;

      // Load provider roster
      const { data: ros } = await supabaseBrowser
        .from('roster')
        .select('initials, full_name')
        .eq('active', true)
        .order('initials');
      setProviders((ros ?? []) as Provider[]);

      // Initial fetch
      await fetchData(addDays(todayStr(), -30), todayStr(), 'ALL');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData(s: string, e: string, p: string) {
    setLoading(true); setMsg(null);
    let q = supabaseBrowser
      .from('discharge_delay_flat')
      .select('event_date, provider_initials, cause, subcause, patient_key, patients_delayed')
      .gte('event_date', s)
      .lte('event_date', e)
      .order('event_date', { ascending: true });

    if (p !== 'ALL') q = q.eq('provider_initials', p);

    const { data, error } = await q;
    if (error) setMsg(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  // Aggregations
  const byCause = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.cause, (m.get(r.cause) ?? 0) + (r.patients_delayed ?? 1)));
    return [...m.entries()].map(([cause, total]) => ({ cause, total }))
      .sort((a,b)=>b.total - a.total);
  }, [rows]);

  const bySubcause = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => {
      const key = `${r.cause} — ${r.subcause || 'Other'}`;
      m.set(key, (m.get(key) ?? 0) + (r.patients_delayed ?? 1));
    });
    return [...m.entries()].map(([label, total]) => ({ label, total }))
      .sort((a,b)=>b.total - a.total);
  }, [rows]);

  const byProvider = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.provider_initials, (m.get(r.provider_initials) ?? 0) + (r.patients_delayed ?? 1)));
    return [...m.entries()].map(([initials, total]) => ({ initials, total }))
      .sort((a,b)=>b.total - a.total);
  }, [rows]);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.event_date, (m.get(r.event_date) ?? 0) + (r.patients_delayed ?? 1)));
    return [...m.entries()].map(([date, total]) => ({ date, total }))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }, [rows]);

  function pct(n: number, max: number) { return max > 0 ? Math.round((n / max) * 100) : 0; }

  function exportCSV(allRows: Row[]) {
    const header = ['event_date','provider_initials','cause','subcause','patient_key','patients_delayed'];
    const lines = [header.join(',')].concat(
      allRows.map(r =>
        [r.event_date, r.provider_initials, csv(r.cause), csv(r.subcause), csv(r.patient_key), String(r.patients_delayed ?? 1)].join(',')
      )
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `discharge_delays_${startDate}_to_${endDate}${provider==='ALL'?'':'_'+provider}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function csv(s: string) {
    const t = (s ?? '').replace(/"/g,'""');
    return `"${t}"`;
  }

  if (isAdmin === null) return null;
  if (!isAdmin) return <div className="max-w-4xl mx-auto p-4"><h1 className="text-xl font-semibold">Admin</h1><p className="text-sm text-gray-600">You do not have access.</p></div>;

  const maxCause = byCause[0]?.total ?? 0;
  const maxSub = bySubcause[0]?.total ?? 0;
  const maxProv = byProvider[0]?.total ?? 0;
  const maxDay = byDay[0]?.total ?? 0;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Discharge Analytics</h1>

      <div className="card grid md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs mb-1">Start date</label>
          <input type="date" className="input w-full" value={startDate}
                 onChange={(e)=>setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1">End date</label>
          <input type="date" className="input w-full" value={endDate}
                 onChange={(e)=>setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1">Provider</label>
          <select className="input w-full" value={provider} onChange={(e)=>setProvider(e.target.value)}>
            <option value="ALL">All providers</option>
            {providers.map(p => <option key={p.initials} value={p.initials}>{p.initials}{p.full_name ? ` — ${p.full_name}` : ''}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary mt-6" onClick={()=>fetchData(startDate, endDate, provider)}>Run</button>
          <button className="btn btn-primary mt-6" onClick={()=>exportCSV(rows)} disabled={!rows.length}>Export CSV</button>
        </div>
      </div>

      {loading ? <p>Loading…</p> : (
        <>
          <Section title="By Cause">
            <BarTable data={byCause.map(x=>({ label:x.cause, value:x.total, pct:pct(x.total, maxCause) }))} />
          </Section>

          <Section title="By Sub-cause">
            <BarTable data={bySubcause.map(x=>({ label:x.label, value:x.total, pct:pct(x.total, maxSub) }))} />
          </Section>

          <Section title="By Provider">
            <BarTable data={byProvider.map(x=>({ label:x.initials, value:x.total, pct:pct(x.total, maxProv) }))} />
          </Section>

          <Section title="By Day">
            <BarTable data={byDay.map(x=>({ label:x.date, value:x.total, pct:pct(x.total, maxDay) }))} />
          </Section>

          <Section title="Raw Rows">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th><th>Provider</th><th>Cause</th><th>Sub-cause</th><th>Patient key</th><th>#</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} className="text-sm text-gray-600">No data in the selected range.</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.event_date}</td>
                      <td>{r.provider_initials}</td>
                      <td>{r.cause}</td>
                      <td>{r.subcause}</td>
                      <td>{r.patient_key}</td>
                      <td>{r.patients_delayed ?? 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}

function Section({ title, children }:{ title:string; children:React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-lg font-medium mb-3">{title}</h2>
      {children}
    </div>
  );
}

function BarTable({ data }:{ data: {label:string; value:number; pct:number}[] }) {
  return (
    <div className="space-y-2">
      {!data.length && <p className="text-sm text-gray-600">No data.</p>}
      {data.map((r, i) => (
        <div key={i} className="grid grid-cols-12 items-center gap-2">
          <div className="col-span-6 sm:col-span-7 truncate" title={r.label}>{r.label}</div>
          <div className="col-span-4 sm:col-span-3">
            <div className="h-2 bg-gray-100 rounded overflow-hidden" title={`${r.value}`}>
              <div className="h-2 rounded bg-gray-400" style={{ width: `${Math.max(6, r.pct)}%` }} />
            </div>
          </div>
          <div className="col-span-2 text-right tabular-nums">{r.value}</div>
        </div>
      ))}
    </div>
  );
}
