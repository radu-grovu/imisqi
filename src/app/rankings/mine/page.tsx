'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Review = {
  id: number;
  review_date: string;            // YYYY-MM-DD
  reviewer_initials: string;
  reviewee_initials: string;
  note_tier: string;
  work_tier: string;
  social_tier: string;
  note_feedback: string | null;
  work_feedback: string | null;
  social_feedback: string | null;
};

type RosterRow = { initials: string; full_name: string; active: boolean };

const TIERS = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-'];

function today() { return new Date().toISOString().slice(0,10); }

export default function MyRankingsPage() {
  const router = useRouter();
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [myInitials, setMyInitials] = useState<string>('');
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [date, setDate] = useState<string>(today());
  const [rows, setRows] = useState<Review[]>([]);
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/auth/login'); return; }
      setSessionUserId(data.session.user.id);
      const [{ data: prof }, { data: ros }] = await Promise.all([
        supabaseBrowser.from('profiles').select('initials').eq('id', data.session.user.id).single(),
        supabaseBrowser.from('roster').select('initials, full_name, active').eq('active', true).order('initials')
      ]);
      setMyInitials(prof?.initials ?? '');
      setRoster(ros ?? []);
      await load(data.session.user.id, date);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(userId: string, d: string) {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('rank_reviews')
      .select('id, review_date, reviewer_initials, reviewee_initials, note_tier, work_tier, social_tier, note_feedback, work_feedback, social_feedback')
      .eq('reviewer_id', userId)
      .eq('review_date', d)
      .order('reviewee_initials', { ascending: true });
    if (error) setMsg(error.message);
    setRows((data ?? []) as Review[]);
    setLoading(false);
  }

  function setField(id:number, field:keyof Review, value:any) {
    setRows(prev => prev.map(r => r.id===id ? { ...r, [field]: value } : r));
  }

  async function addRow() {
    if (!sessionUserId) return;
    // pick first colleague not yourself, if available
    const firstColleague = roster.find(r => r.initials !== myInitials)?.initials || '';
    const payload = {
      reviewer_id: sessionUserId,
      reviewer_initials: myInitials || '??',
      reviewee_initials: firstColleague,
      review_date: date,
      note_tier: 'B',
      work_tier: 'B',
      social_tier: 'B',
      note_feedback: null,
      work_feedback: null,
      social_feedback: null
    };
    const { data, error } = await supabaseBrowser
      .from('rank_reviews')
      .insert(payload)
      .select('id, review_date, reviewer_initials, reviewee_initials, note_tier, work_tier, social_tier, note_feedback, work_feedback, social_feedback')
      .single();
    if (error) { setMsg(error.message); return; }
    setRows(prev => [...prev, data as Review]);
  }

  async function saveRow(r: Review) {
    const { error } = await supabaseBrowser
      .from('rank_reviews')
      .update({
        reviewee_initials: r.reviewee_initials,
        note_tier: r.note_tier,
        work_tier: r.work_tier,
        social_tier: r.social_tier,
        note_feedback: r.note_feedback,
        work_feedback: r.work_feedback,
        social_feedback: r.social_feedback
      })
      .eq('id', r.id);
    if (error) { setMsg(error.message); return; }
    setMsg('Saved.');
    setTimeout(()=>setMsg(null), 1500);
  }

  async function delRow(id:number) {
    if (!confirm('Delete this review?')) return;
    const { error } = await supabaseBrowser.from('rank_reviews').delete().eq('id', id);
    if (error) { setMsg(error.message); return; }
    setRows(prev => prev.filter(x => x.id !== id));
  }

  const remaining = useMemo(() => {
    const already = new Set(rows.map(r => r.reviewee_initials));
    return roster.filter(r => r.initials !== myInitials && !already.has(r.initials));
  }, [rows, roster, myInitials]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My Rankings</h1>

      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs">Date</label>
          <input type="date" className="input" value={date}
                 onChange={async (e)=>{ setDate(e.target.value); if (sessionUserId) await load(sessionUserId, e.target.value); }} />
        </div>
        <button className="btn btn-secondary" onClick={addRow}>Add Colleague</button>
        <div className="text-xs text-gray-600 ml-auto">
          You can rate any subset now and come back later the same day to add/edit more.
        </div>
      </div>

      <div className="card">
        {loading ? <p>Loading…</p> : (
          <div className="space-y-4">
            {!rows.length && <p className="text-sm text-gray-600">No reviews for this date. Click “Add Colleague”.</p>}

            {rows.map(r => (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs">Colleague</label>
                  <select className="input"
                          value={r.reviewee_initials}
                          onChange={(e)=>setField(r.id,'reviewee_initials', e.target.value)}>
                    {[{ initials: r.reviewee_initials, full_name: '' }, ...remaining]
                      .filter((v,i,a)=>a.findIndex(x=>x.initials===v.initials)===i)
                      .map(opt => (
                        <option key={opt.initials} value={opt.initials}>{opt.initials}</option>
                      ))}
                  </select>
                  <div className="ml-auto flex gap-2">
                    <button className="btn btn-secondary" onClick={()=>saveRow(r)}>Save</button>
                    <button className="btn btn-danger" onClick={()=>delRow(r.id)}>Delete</button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <TierPicker label="Note Quality" value={r.note_tier} onChange={(v)=>setField(r.id,'note_tier', v)} />
                  <TierPicker label="Work Ethic"   value={r.work_tier} onChange={(v)=>setField(r.id,'work_tier', v)} />
                  <TierPicker label="Personality"  value={r.social_tier} onChange={(v)=>setField(r.id,'social_tier', v)} />
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <textarea className="input" placeholder="Note feedback (optional)" value={r.note_feedback ?? ''} onChange={(e)=>setField(r.id,'note_feedback', e.target.value)} />
                  <textarea className="input" placeholder="Work feedback (optional)" value={r.work_feedback ?? ''} onChange={(e)=>setField(r.id,'work_feedback', e.target.value)} />
                  <textarea className="input" placeholder="Personality feedback (optional)" value={r.social_feedback ?? ''} onChange={(e)=>setField(r.id,'social_feedback', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

function TierPicker({ label, value, onChange }:{ label:string; value:string; onChange:(v:string)=>void }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs mb-1">{label}</span>
      <select className="input w-full" value={value} onChange={(e)=>onChange(e.target.value)}>
        {['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-'].map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </label>
  );
}
