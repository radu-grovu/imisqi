'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabaseBrowser';

type Row = { review_date: string; note_avg: number|null; work_avg: number|null; social_avg: number|null; n_raters: number };

export default function MyAveragesPage() {
  const [initials, setInitials] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabaseBrowser.auth.getSession();
      if (!sess.session) return;
      const { data: prof } = await supabaseBrowser.from('profiles').select('initials').eq('id', sess.session.user.id).single();
      const me = prof?.initials ?? '';
      setInitials(me);
      const { data } = await supabaseBrowser
        .from('rank_daily_averages')
        .select('review_date, note_avg, work_avg, social_avg, n_raters')
        .eq('reviewee_initials', me)
        .order('review_date', { ascending: false });
      setRows(data ?? []);
    })();
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Your Daily Averages</h1>
      {initials && <p className="text-sm text-gray-700">For: {initials}</p>}
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Note</th><th>Work</th><th>Personality</th><th># Raters</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.review_date}>
                <td>{r.review_date}</td>
                <td>{r.note_avg?.toFixed(2) ?? '-'}</td>
                <td>{r.work_avg?.toFixed(2) ?? '-'}</td>
                <td>{r.social_avg?.toFixed(2) ?? '-'}</td>
                <td>{r.n_raters}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600">Averages hide raters and individual scores.</p>
    </div>
  );
}
