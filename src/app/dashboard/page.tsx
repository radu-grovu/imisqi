'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { campaignDates } from '@/utils/date';

type Campaign = { id: string; name: string; start_date: string; days: number };

type Missing = { date: string; link: string };

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [missing, setMissing] = useState<Record<string, Missing[]>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) { window.location.href = '/'; return; }
      setUser(user);
      await fetch('/api/sync-memberships', { method: 'POST' });
      const { data: camps, error } = await supabaseBrowser.from('campaigns').select('id, name, start_date, days');
      if (error) { alert(error.message); return; }
      setCampaigns(camps || []);
      const miss: Record<string, Missing[]> = {};
      for (const c of camps || []) {
        const dates = campaignDates(new Date(c.start_date + 'T00:00:00'), c.days);
        const { data: rows } = await supabaseBrowser
          .from('responses')
          .select('survey_date')
          .eq('campaign_id', c.id)
          .eq('profile_id', user.id);
        const done = new Set((rows || []).map(r => r.survey_date));
        miss[c.id] = dates.filter(d => !done.has(d)).map(d => ({ date: d, link: `/survey/${d}?campaign=${c.id}` }));
      }
      setMissing(miss);
    })();
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      {!campaigns.length && <p>No active campaigns yet.</p>}
      {campaigns.map(c => (
        <div key={c.id} style={{ border: '1px solid #ddd', padding: 12, margin: '12px 0' }}>
          <h3>{c.name}</h3>
          <p>Start: {c.start_date} · Days: {c.days}</p>
          <p><a href={`/survey/${new Date().toISOString().slice(0,10)}?campaign=${c.id}`}>Fill Today’s Survey →</a></p>
          {!!(missing[c.id]?.length) && (
            <details>
              <summary>Missed days ({missing[c.id].length})</summary>
              <ul>
                {missing[c.id].map(m => (
                  <li key={m.date}><a href={m.link}>{m.date}</a></li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
