'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList
} from 'recharts';

type Row = {
  anonymized_reviewer_id: string;
  reviewee_initials: string;
  review_date: string; // YYYY-MM-DD
  note_tier: string;
  work_tier: string;
  social_tier: string;
  note_feedback: string | null;
  work_feedback: string | null;
  social_feedback: string | null;
  created_at: string;
  updated_at: string;
};

type Agg = {
  reviewee: string;
  noteAvg: number;
  workAvg: number;
  socialAvg: number;
  overall: number;  // mean of three avgs
  nRatings: number; // total number of ratings across the period
};

const TIER_TO_SCORE: Record<string, number> = {
  'A+':4.3,'A':4.0,'A-':3.7,'B+':3.3,'B':3.0,'B-':2.7,
  'C+':2.3,'C':2.0,'C-':1.7,'D+':1.3,'D':1.0,'D-':0.7
};

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0,10);
}
function today(): string { return new Date().toISOString().slice(0,10); }

export default function RankingsAdmin() {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  async function load() {
    setMsg(null); setLoading(true);
    try {
      let q = supabaseBrowser.from('rank_admin_anonymized')
        .select('anonymized_reviewer_id, reviewee_initials, review_date, note_tier, work_tier, social_tier, note_feedback, work_feedback, social_feedback, created_at, updated_at')
        .order('review_date', { ascending: true })
        .limit(50000);
      if (from) (q as any).gte('review_date', from);
      if (to) (q as any).lte('review_date', to);
      const { data, error } = await q;
      if (error) throw error;
      setRows(data ?? []);
    } catch (e:any) {
      setMsg(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);

  const aggregates: Agg[] = useMemo(() => {
    const m: Record<string, { note:number[]; work:number[]; social:number[]; n:number }> = {};
    rows.forEach(r => {
      const note = TIER_TO_SCORE[r.note_tier] ?? null;
      const work = TIER_TO_SCORE[r.work_tier] ?? null;
      const social = TIER_TO_SCORE[r.social_tier] ?? null;
      if (!m[r.reviewee_initials]) m[r.reviewee_initials] = { note:[], work:[], social:[], n:0 };
      if (note != null) m[r.reviewee_initials].note.push(note);
      if (work != null) m[r.reviewee_initials].work.push(work);
      if (social != null) m[r.reviewee_initials].social.push(social);
      m[r.reviewee_initials].n += 1;
    });
    const out: Agg[] = Object.entries(m).map(([reviewee, v]) => {
      const noteAvg = v.note.length ? avg(v.note) : 0;
      const workAvg = v.work.length ? avg(v.work) : 0;
      const socialAvg = v.social.length ? avg(v.social) : 0;
      const overall = (noteAvg + workAvg + socialAvg) / 3;
      return { reviewee, noteAvg, workAvg, socialAvg, overall, nRatings: v.n };
    });
    // sort overall desc
    out.sort((a,b)=> b.overall - a.overall);
    return out;
  }, [rows]);

  function avg(a:number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }

  function toCSV(data: Row[]): string {
    if (!data.length) return '';
    const headers = ['review_date','anonymized_reviewer_id','reviewee_initials','note_tier','work_tier','social_tier'];
    const lines = [headers.join(',')];
    data.forEach(r => {
      const vals = headers.map(h => {
        const v = (r as any)[h] ?? '';
        const s = String(v).replace(/"/g,'""');
        return `"${s}"`;
      });
      lines.push(vals.join(','));
    });
    return lines.join('\n');
  }

  function downloadCSV() {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `imis_rankings_${from}_${to}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Data for charts
  const overallData = aggregates.map(a => ({ name: a.reviewee, value: Number(a.overall.toFixed(2)) }));
  const noteData    = aggregates.map(a => ({ name: a.reviewee, value: Number(a.noteAvg.toFixed(2)) }));
  const workData    = aggregates.map(a => ({ name: a.reviewee, value: Number(a.workAvg.toFixed(2)) }));
  const socialData  = aggregates.map(a => ({ name: a.reviewee, value: Number(a.socialAvg.toFixed(2)) }));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Hospitalist Rankings</h2>

      <div className="flex gap-2 items-end">
        <div><label className="block text-xs">From</label><input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} /></div>
        <div><label className="block text-xs">To</label><input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} /></div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>{loading?'Loading…':'Run'}</button>
        <button className="btn btn-primary" onClick={downloadCSV} disabled={!rows.length}>Download CSV (Anonymized)</button>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Hospitalist</th><th>Overall</th><th>Note</th><th>Work</th><th>Personality</th><th># Ratings</th></tr>
          </thead>
          <tbody>
            {aggregates.map(a => (
              <tr key={a.reviewee}>
                <td>{a.reviewee}</td>
                <td>{a.overall.toFixed(2)}</td>
                <td>{a.noteAvg.toFixed(2)}</td>
                <td>{a.workAvg.toFixed(2)}</td>
                <td>{a.socialAvg.toFixed(2)}</td>
                <td>{a.nRatings}</td>
              </tr>
            ))}
            {!aggregates.length && <tr><td colSpan={6} className="text-sm text-gray-600">No data in range.</td></tr>}
          </tbody>
        </table>
      </div>

      <ChartBlock title="Overall (sorted)">
        <BarSeries data={overallData} />
      </ChartBlock>

      <div className="grid md:grid-cols-3 gap-4">
        <ChartBlock title="Note Quality"><BarSeries data={noteData} /></ChartBlock>
        <ChartBlock title="Work Ethic"><BarSeries data={workData} /></ChartBlock>
        <ChartBlock title="Personality/Sociability"><BarSeries data={socialData} /></ChartBlock>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </section>
  );
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <div style={{ width: '100%', height: 320 }}>{children}</div>
    </div>
  );
}

function BarSeries({ data }: { data: { name:string; value:number }[] }) {
  // Recharts sorts by data order; our aggregates are already sorted
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
