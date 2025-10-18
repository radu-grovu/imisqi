// src/app/rankings/page.tsx
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
  note_feedback: string;
  work_feedback: string;
  social_feedback: string;
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
  const [openReview, setOpenReview] = useState<Review|null>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  // On mount: check session and load user info & roster
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/auth/login'); return; }
      setUserId(data.session.user.id);
      // Get reviewer initials from profiles, and active roster
      const [{ data: prof }, { data: ros }] = await Promise.all([
        supabaseBrowser.from('profiles').select('initials').eq('id', data.session.user.id).single(),
        supabaseBrowser.from('roster').select('initials, full_name, active').eq('active', true).order('initials')
      ]);
      setMyInitials(prof?.initials ?? '');
      setRoster(ros ?? []);
    })();
  }, [router]);

  // Load existing rankings for the given date
  async function loadRankings(uid: string, d: string) {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('rank_reviews')
      .select('id, review_date, reviewer_initials, reviewee_initials, note_tier, work_tier, social_tier, note_feedback, work_feedback, social_feedback')
      .eq('reviewer_id', uid)
      .eq('review_date', d)
      .order('reviewee_initials', { ascending: true });
    if (error) { setMsg(error.message); }
    setRows((data as Review[]) ?? []);
    setLoading(false);
  }

  function handleStart() {
    if (!userId) return;
    loadRankings(userId, date);
    setStarted(true);
  }

  // Determine which hospitalists are already ranked
  const rankedSet = useMemo(() => new Set(rows.map(r => r.reviewee_initials)), [rows]);

  function handleBoxClick(initials: string) {
    // If already have a Review, open it; otherwise start a new one
    const existing = rows.find(r => r.reviewee_initials === initials);
    if (existing) {
      setOpenReview({ ...existing });
    } else {
      setOpenReview({
        review_date: date,
        reviewer_initials: myInitials,
        reviewee_initials: initials,
        note_tier: 'B',
        work_tier: 'B',
        social_tier: 'B',
        note_feedback: '',
        work_feedback: '',
        social_feedback: ''
      });
    }
  }

  async function saveReview() {
    if (!userId || !openReview) return;
    const payload = {
      reviewer_id: userId,
      reviewer_initials: openReview.reviewer_initials,
      reviewee_initials: openReview.reviewee_initials,
      review_date: openReview.review_date,
      note_tier: openReview.note_tier,
      work_tier: openReview.work_tier,
      social_tier: openReview.social_tier,
      note_feedback: openReview.note_feedback,
      work_feedback: openReview.work_feedback,
      social_feedback: openReview.social_feedback
    };
    const { data, error } = await supabaseBrowser
      .from('rank_reviews')
      .upsert(payload, { onConflict: 'reviewer_id,reviewee_initials,review_date' })
      .select('id')
      .single();
    if (error) { setMsg(error.message); return; }
    // Update state: assign id and add/replace the row
    const savedId = data?.id;
    setRows(prev => {
      const exists = prev.find(r => r.reviewee_initials === openReview.reviewee_initials);
      const newRow = { ...openReview, id: savedId };
      if (exists) {
        return prev.map(r => r.reviewee_initials === openReview.reviewee_initials ? newRow : r);
      } else {
        return [...prev, newRow];
      }
    });
    setMsg('Saved.');
    setOpenReview(null);
    setTimeout(()=>setMsg(null), 1200);
  }

  function cancelReview() {
    setOpenReview(null);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Hospitalist Rankings 
        <span className="ml-2 inline-block bg-yellow-200 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded">BETA</span>
      </h1>

      {/* Date selector and Start button */}
      <div className="card flex flex-wrap gap-3 items-center">
        <div>
          <label className="block text-xs mb-1">Date</label>
          <input 
            type="date" 
            className="input" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
          />
        </div>
        <button 
          className="btn btn-primary mt-5" 
          onClick={handleStart}
        >
          Start Ranking
        </button>
      </div>

      {/* Grid of hospitalist boxes (shown after Start) */}
      {started && (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {roster
            .filter(r => r.initials !== myInitials)  // do not show self
            .map(r => (
              <div 
                key={r.initials}
                className={`p-4 border rounded-lg cursor-pointer 
                           ${rankedSet.has(r.initials) ? 'bg-green-200 border-green-400' : 'bg-red-200 border-red-400'}
                           hover:opacity-90`}
                onClick={() => handleBoxClick(r.initials)}
                title={r.full_name}
              >
                <div className="text-lg font-medium">{r.initials}</div>
                <div className="text-xs text-gray-700">{r.full_name}</div>
              </div>
          ))}
        </div>
      )}

      {/* Popover for editing a review */}
      {openReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg space-y-4">
            <h3 className="text-xl font-semibold">Rank {openReview.reviewee_initials}</h3>
            {/* Tier pickers */}
            <div className="grid grid-cols-3 gap-4">
              <TierPicker 
                label="Note Quality" 
                value={openReview.note_tier} 
                onChange={(v) => setOpenReview(prev => prev ? { ...prev, note_tier: v } : null)} 
              />
              <TierPicker 
                label="Work Ethic" 
                value={openReview.work_tier} 
                onChange={(v) => setOpenReview(prev => prev ? { ...prev, work_tier: v } : null)} 
              />
              <TierPicker 
                label="Personality" 
                value={openReview.social_tier} 
                onChange={(v) => setOpenReview(prev => prev ? { ...prev, social_tier: v } : null)} 
              />
            </div>
            {/* Feedback textareas */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1">Note Feedback (optional)</label>
                <textarea
                  className="input w-full"
                  placeholder="Enter comments (max 150 chars)"
                  value={openReview.note_feedback}
                  maxLength={150}
                  onChange={(e) => setOpenReview(prev => prev ? { ...prev, note_feedback: e.target.value } : null)}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Work Feedback (optional)</label>
                <textarea
                  className="input w-full"
                  placeholder="Enter comments (max 150 chars)"
                  value={openReview.work_feedback}
                  maxLength={150}
                  onChange={(e) => setOpenReview(prev => prev ? { ...prev, work_feedback: e.target.value } : null)}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Personality Feedback (optional)</label>
                <textarea
                  className="input w-full"
                  placeholder="Enter comments (max 150 chars)"
                  value={openReview.social_feedback}
                  maxLength={150}
                  onChange={(e) => setOpenReview(prev => prev ? { ...prev, social_feedback: e.target.value } : null)}
                />
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={cancelReview}>Cancel</button>
              <button className="btn btn-primary" onClick={saveReview}>Save</button>
            </div>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-green-700">{msg}</p>}
    </div>
  );
}

// Subcomponent for selecting a tier grade
function TierPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs mb-1">{label}</span>
      <select className="input w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  );
}
