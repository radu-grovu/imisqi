'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { useRouter } from 'next/navigation';

type Review = {
  id?: number;
  review_date: string;
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

export default function RankingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string|null>(null);
  const [myInitials, setMyInitials] = useState<string>('');
  const [date, setDate] = useState<string>(today());
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rows, setRows] = useState<Review[]>([]);
  const [adding, setAdding] = useState<string>(''); // initials to add
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/auth/login'); return; }
      setUserId(data.session.user.id);
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

  async function load(uid:string, d:string) {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('rank_reviews')
      .select('id, review_date, reviewer_initials, reviewee_initials, note_tier, work_tier, social_tier, note_feedback, work_feedback, social_feedback')
      .eq('reviewer_id', uid)
      .eq('review_date', d)
      .order('reviewee_initials', { ascending: true });
    if (error) setMsg(error.message);
    setRows(((data ?? []) as Review[]).map(r => ({ ...r })));
    setLoading(false);
  }

  const available = useMemo(() => {
    const already = new Set(rows.map(r => r.reviewee_initials));
    return roster
      .filter(r => r.initials !== myInitials && !already.has(r.initials));
  }, [rows, roster, myInitials]);

  function setField(id:number|undefined, field:keyof Review, value:any) {
    setRows(prev => prev.map(r => r.id===id ? { ...r, [field]: value } : r));
  }

  function addColleague() {
    if (!userId || !myInitials || !adding) return;
    const exists = rows.find(r => r.reviewee_initials === adding);
    if (exists) return;
    const draft: Review = {
      review_date: date,
      reviewer_initials: myInitials,
      reviewee_initials: adding,
      note_tier: 'B',
      work_tier: 'B',
      social_tier: 'B',
      note_feedback: null,
      work_feedback: null,
      social_feedback: null
    };
    setRows(prev => [...prev, draft]);
    setAdding('');
  }

  async function saveRow(r: Review) {
    if (!userId) return;
    // upsert by unique key (reviewer_id, reviewee_initials, review_date)
    const payload = {
      reviewer_id: userId,
      reviewer_initials: r.reviewer_initials,
      reviewee_initials: r.reviewee_initials,
      review_date: r.review_date,
      note_tier: r.note_tier,
      work_tier: r.work_tier,
      social_tier: r.social_tier,
      note_feedback: r.note_feedback,
      work_feedback: r.work_feedback,
      social_feedback: r.social_feedback
    };
    const { data, error } = await supabaseBrowser
      .from('rank_reviews')
      .upsert(payload, { onConflict: 'reviewer_id,reviewee_initials,review_date' })
      .select('id')
      .single();
    if (error) { setMsg(error.message); return; }
    // Assign id to the row if it was a draft
    setRows(prev => prev.map(x => (x.reviewee_initials===r.reviewee_initials && x.review_date===r.review_date) ? { ...r, id: data?.id } : x));
    setMsg('Saved.');
    setTimeout(()=>setMsg(null), 1200);
  }

  async function saveAll() {
    if (!userId || !rows.length) return;
    const payloads = rows.map(r => ({
      reviewer_id: userId,
      reviewer_initials: r.reviewer_initials,
      reviewee_initials: r.reviewee_initials,
      review_date: r.review_date,
      note_tier: r.note_tier,
      work_tier: r.work_tier,
      social_tier: r.social_tier,
      note_feedback: r.note_feedback,
      work_feedback: r.work_feedback,
      social_feedback: r.social_feedback
    }));
    const { error } = await supabaseBrowser
      .from('rank_reviews')
      .upsert(payloads, { onConflict: 'reviewer_id,reviewee_initials,review_date' });
    if (error) { setMsg(error.message); return; }
    // Reload to ensure ids are present and order normalized
    await load(userId, date);
    setMsg('Saved all.');
    setTimeout(()=>setMsg(null), 1200);
  }

  async function delRow(id:number|undefined, reviewee:string) {
    if (!userId) return;
    if (!id) {
      // draft not yet inserted
      setRows(prev => prev.filter(r => !(r.reviewee_initials===reviewee && r.review_date===date)));
      return;
    }
    if (!confirm('Delete this review?')) return;
    const { error } = await supabaseBrowser.from('rank_reviews').delete().eq('id', id);
    if (error) { setMsg(error.message); return; }
    setRows(prev => prev.filter(r => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rankings</h1>

      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs mb-1">Date</label>
          <input type="date" className="input" value={date}
            onChange={async (e)=>{ setDate(e.target.value); if (userId) await load(userId, e.target.value); }} />
        </div>

        <div className="flex items-end gap-2">
          <label className="block text-xs mb-1">Add colleague</label>
          <div className="flex gap-2">
            <select className="input min-w-[8rem]" value={adding} onChange={(e)=>setAdding(e.target.value)}>
              <option value="">— Choose —</option>
              {available.map(r => <option key={r.initials} value={r.initials}>{r.initials} — {r.full_name}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={addColleague}>Add</button>
          </div>
        </div>

        <div className="ml-auto">
          <button className="btn btn-primary" onClick={saveAll} disabled={!rows.length}>Save Today’s Rankings</button>
        </div>
      </div>

      <div className="card">
        {loading ? <p>Loading…</p> : rows.length ? (
          <div className="space-y-4">
            {rows.map(r => (
              <div key={`${r.id ?? 'draft'}-${r.reviewee_initials}`} className="border rounded-lg p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm">
                    <span className="i i-pencil mr-1" title="Edit" />
                    <b>{r.reviewee_initials}</b>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button className="btn btn-secondary" onClick={()=>saveRow(r)}>Save</button>
                    <button className="btn btn-danger" onClick={()=>delRow(r.id, r.reviewee_initials)}>Delete</button>
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
        ) : <p className="text-sm text-gray-600">No rankings yet for this date. Use “Add colleague”. You don’t have to rate everyone.</p>}
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
