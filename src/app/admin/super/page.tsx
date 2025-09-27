'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabaseBrowser';

type Row = {
  reviewer_initials: string;
  reviewee_initials: string;
  review_date: string;
  note_tier: string; work_tier: string; social_tier: string;
  note_feedback: string | null; work_feedback: string | null; social_feedback: string | null;
  created_at: string; updated_at: string;
};

export default function SuperAdminPage() {
  const [isRG, setIsRG] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabaseBrowser.auth.getSession();
      if (!sess.session) return;
      const { data: prof } = await supabaseBrowser.from('profiles').select('initials').eq('id', sess.session.user.id).single();
      setIsRG((prof?.initials ?? '') === 'RG');
    })();
  }, []);

  async function load() {
    let q = supabaseBrowser.from('rank_reviews')
      .select('reviewer_initials, reviewee_initials, review_date, note_tier, work_tier, social_tier, note_feedback, work_feedback, social_feedback, created_at, updated_at')
      .order('review_date', { ascending: false })
      .limit(2000);
    if (from) (q as any).gte('review_date', from);
    if (to) (q as any).lte('review_date', to);
    const { data, error } = await q;
    if (!error) setRows(data ?? []);
  }

  function downloadCSV() {
    const u = new URL('/api/admin/super/export', window.location.origin);
    if (from) u.searchParams.set('from', from);
    if (to) u.searchParams.set('to', to);
    window.location.href = u.toString();
  }

  if (!isRG) return <div className="card">Super Admin (RG) only.</div>;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Super Admin · De-anonymized Reviews</h1>
      <div className="flex gap-2 items-end">
        <div><label className="block text-xs">From</label><input type="date" className="input" value={from} onChange={(e)=>setFrom(e.target.value)} /></div>
        <div><label className="block text-xs">To</label><input type="date" className="input" value={to} onChange={(e)=>setTo(e.target.value)} /></div>
        <button className="btn btn-secondary" onClick={load}>Load</button>
        <button className="btn btn-primary" onClick={downloadCSV}>Download CSV (All)</button>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Reviewer</th><th>Reviewee</th><th>Date</th>
              <th>Note</th><th>Work</th><th>Personality</th>
              <th>FB:Notes</th><th>FB:Work</th><th>FB:Personality</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={i}>
                <td>{r.reviewer_initials}</td>
                <td>{r.reviewee_initials}</td>
                <td>{r.review_date}</td>
                <td>{r.note_tier}</td>
                <td>{r.work_tier}</td>
                <td>{r.social_tier}</td>
                <td>{r.note_feedback ?? ''}</td>
                <td>{r.work_feedback ?? ''}</td>
                <td>{r.social_feedback ?? ''}</td>
                <td>{new Date(r.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600">Only you (RG) can see this page, and only because RLS allows RG to select all rows.</p>
    </div>
  );
}
