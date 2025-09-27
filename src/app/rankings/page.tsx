'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabaseBrowser';
import { TIER_OPTIONS, Tier } from '../../lib/rankTiers';

type RosterEntry = { initials: string; full_name: string; active: boolean };

function isoToday() {
  return new Date().toISOString().slice(0,10);
}

export default function RankingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ id: string; initials: string } | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rows, setRows] = useState<Record<string, {
    note_tier?: Tier; work_tier?: Tier; social_tier?: Tier;
    note_feedback?: string; work_feedback?: string; social_feedback?: string;
  }>>({});
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = useMemo(() => isoToday(), []);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabaseBrowser.auth.getSession();
      if (!sess.session) { router.replace('/'); return; }
      const uid = sess.session.user.id;

      const { data: prof } = await supabaseBrowser
        .from('profiles').select('initials').eq('id', uid).single();
      const initials = prof?.initials ?? '';
      setMe({ id: uid, initials });

      const { data: r } = await supabaseBrowser
        .from('roster').select('initials, full_name, active').eq('active', true).order('initials');
      const peers = (r ?? []).filter((p: RosterEntry) => p.initials !== initials);
      setRoster(peers);

      const { data: mine } = await supabaseBrowser
        .from('rank_reviews')
        .select('reviewee_initials, note_tier, work_tier, social_tier, note_feedback, work_feedback, social_feedback')
        .eq('reviewer_id', uid)
        .eq('review_date', today);

      const init: typeof rows = {};
      (mine ?? []).forEach((row: any) => {
        init[row.reviewee_initials] = {
          note_tier: row.note_tier,
          work_tier: row.work_tier,
          social_tier: row.social_tier,
          note_feedback: row.note_feedback ?? '',
          work_feedback: row.work_feedback ?? '',
          social_feedback: row.social_feedback ?? '',
        };
      });
      setRows(init);
      setBusy(false);
    })();
  }, [router, today]);

  function setField(target: string, key: keyof (typeof rows)[string], val: string) {
    setRows(prev => ({ ...prev, [target]: { ...(prev[target] ?? {}), [key]: val } }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setMsg(null);
    setSaving(true);
    try {
      const payload = roster.map(p => {
        const r = rows[p.initials] ?? {};
        if (!r.note_tier || !r.work_tier || !r.social_tier) {
          throw new Error(`Missing ratings for ${p.initials}`);
        }
        return {
          reviewer_id: me.id,
          reviewer_initials: me.initials,
          reviewee_initials: p.initials,
          review_date: today,
          note_tier: r.note_tier,
          work_tier: r.work_tier,
          social_tier: r.social_tier,
          note_feedback: r.note_feedback || null,
          work_feedback: r.work_feedback || null,
          social_feedback: r.social_feedback || null,
        };
      });
      const { error } = await supabaseBrowser.from('rank_reviews').upsert(payload);
      if (error) throw error;
      setMsg('✅ Saved. You can update later today.');
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (busy) return <div className="card">Loading…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Daily Rankings</h1>
      <p className="text-sm text-gray-700">Date: <b>{today}</b>. You rate every colleague (not yourself). Recipients only see averages; you can see and edit what you gave others today.</p>

      <form onSubmit={onSave} className="space-y-3">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Colleague</th>
                <th>Note Quality</th>
                <th>Work Ethic</th>
                <th>Personality/Sociability</th>
                <th>FB: Notes</th>
                <th>FB: Work</th>
                <th>FB: Personality</th>
              </tr>
            </thead>
            <tbody>
              {roster.map(p => {
                const r = rows[p.initials] ?? {};
                return (
                  <tr key={p.initials}>
                    <td>{p.full_name} ({p.initials})</td>
                    {(['note_tier','work_tier','social_tier'] as const).map((k, idx) => (
                      <td key={k}>
                        <select className="input" required
                          value={(r[k] as string) ?? ''}
                          onChange={(e) => setField(p.initials, k, e.target.value)}>
                          <option value="">--Tier--</option>
                          {TIER_OPTIONS.map(t => <option key={`${k}-${p.initials}-${t}`}>{t}</option>)}
                        </select>
                      </td>
                    ))}
                    <td><input className="input" placeholder="Ways to improve (notes)"
                      value={r.note_feedback ?? ''} onChange={(e)=>setField(p.initials,'note_feedback', e.target.value)} /></td>
                    <td><input className="input" placeholder="Ways to improve (work)"
                      value={r.work_feedback ?? ''} onChange={(e)=>setField(p.initials,'work_feedback', e.target.value)} /></td>
                    <td><input className="input" placeholder="Ways to improve (personality)"
                      value={r.social_feedback ?? ''} onChange={(e)=>setField(p.initials,'social_feedback', e.target.value)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Today’s Rankings'}</button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
    </div>
  );
}
