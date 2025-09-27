'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, LabelList } from 'recharts';

type Row = { event_date: string; provider_initials: string; cause: string; patients_delayed: number };

function defaultFrom(): string {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0,10);
}
function today(): string { return new Date().toISOString().slice(0,10); }

export default function DischargeAdmin() {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  async function load() {
    setMsg(null); setLoading(true);
    try {
      let q = supabaseBrowser.from('discharge_delay_flat')
        .select('event_date, provider_initials, cause, patients_delayed')
        .order('event_date', { ascending: true })
        .limit(50000);
      if (from) (q as any).gte('event_date', from);
      if (to) (q as any).lte('event_date', to);
      const { data, error } = await q;
      if (error) throw error;
      setRows(data ?? []);
    } catch (e:any) {
      setMsg(e.message ?? 'Failed to load discharge delays. If you do not have a view named discharge_delay_flat, either create it or update this tab to match your schema.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);

  const byCause = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.cause, (m.get(r.cause) ?? 0) + (r.patients_delayed ?? 0)));
    return [...m.entries()].map(([label,value]) => ({ label, value })).sort((a,b)=>b.value-a.value);
  }, [rows]);

  const byProvider = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.provider_initials, (m.get(r.provider_initials) ?? 0) + (r.patients_delayed ?? 0)));
    return [...m.entries()].map(([label,value]) => ({ label, value })).sort((a,b)=>b.value-a.value);
  }, [rows]);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.event_date, (m.get(r.event_date) ?? 0) + 1));
    return [...m.entries()].map(([date,count]) => ({ date, count })).sort((a,b)=> a.date.localeCompare(b.date));
  }, [rows]);

  function toCSV<T extends Record<string, any>>(arr: T[]): string {
    if (!arr.length) return '';
    const headers = Object.keys(arr[0]);
    const lines = [headers.join(',')];
    arr.forEach(obj => {
      const vals = headers.map(h => {
        const v = obj[h] ?? '';
        const s = String(v).replace(/"/g,'""');
        return `"${s}"`;
      });
      lines.push(vals.join(','));
    });
    return lines.join('\n');
  }

  function dl(name:string, csv:string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const rawCSV = toCSV(rows);
  const causeCSV = toCSV(byCause);
  const provCSV = toCSV(byProvider);
  const dailyCSV = toCSV(byDay);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Discharge Delays</h2>

      <div className="flex gap-2 items-end">
        <div><label className="block text-xs">From</label><input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} /></div>
        <div><label className="block text-xs">To</label><input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} /></div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>{loading?'Loading…':'Run'}</button>
        <button className="btn btn-primary" onClick={()=>dl(`discharge_raw_${from}_${to}.csv`, rawCSV)} disabled={!rows.length}>Export Raw CSV</button>
        <button className="btn btn-secondary" onClick={()=>dl(`discharge_causes_${from}_${to}.csv`, causeCSV)} disabled={!byCause.length}>Export Causes CSV</button>
        <button className="btn btn-secondary" onClick={()=>dl(`discharge_providers_${from}_${to}.csv`, provCSV)} disabled={!byProvider.length}>Export Providers CSV</button>
        <button className="btn btn-secondary" onClick={()=>dl(`discharge_daily_${from}_${to}.csv`, dailyCSV)} disabled={!byDay.length}>Export Daily CSV</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Top Delay Causes">
          <BarSeries data={byCause.map(x=>({ name:x.label, value:x.value }))} />
        </ChartCard>
        <ChartCard title="Delays per Provider">
          <BarSeries data={byProvider.map(x=>({ name:x.label, value:x.value }))} />
        </ChartCard>
      </div>

      <ChartCard title="Daily Submission Counts">
        <ResponsiveContainer>
          <LineChart data={byDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" dot />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </section>
  );
}

function ChartCard({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <div style={{ width:'100%', height: 360 }}>{children}</div>
    </div>
  );
}

function BarSeries({ data }: { data:{ name:string; value:number }[] }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={80} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value">
          <LabelList dataKey="value" position="top" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
