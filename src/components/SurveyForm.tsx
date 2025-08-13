'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function SurveyForm({ campaignId, date }: { campaignId: string; date: string; }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const didDelay = formData.get('didDelay') === 'yes';
    const reason = String(formData.get('reason') || '');
    const days = String(formData.get('days') || '0');
    const comments = String(formData.get('comments') || '');

    const { data: { user } } = await supabaseBrowser.auth.getUser();
    if (!user) { alert('Please sign in'); setLoading(false); return; }

    const answers = { didDelay, reason, days, comments };
    const { error } = await supabaseBrowser.from('responses').upsert({
      campaign_id: campaignId,
      profile_id: user.id,
      survey_date: date,
      answers
    });
    setLoading(false);
    if (error) alert(error.message); else setDone(true);
  }

  if (done) return <p style={{ color: 'green' }}>Thanks — response saved.</p>;

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <div>
        <label><strong>Was discharge delayed today?</strong></label><br/>
        <label><input type="radio" name="didDelay" value="yes" required /> Yes</label>
        {' '}
        <label><input type="radio" name="didDelay" value="no" required /> No</label>
      </div>
      <div>
        <label><strong>Primary reason (if delayed)</strong></label><br/>
        <select name="reason" defaultValue="">
          <option value="">— Select —</option>
          <option>Awaiting diagnostic test result</option>
          <option>Awaiting specialist consult</option>
          <option>Awaiting placement/transfer</option>
          <option>Awaiting family meeting</option>
          <option>Awaiting procedure</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label><strong>Estimated avoidable days</strong></label><br/>
        <select name="days" defaultValue="0">
          <option value="0">0</option>
          <option value="0.5">0.5</option>
          <option value="1">1</option>
          <option value=">1">&gt;1</option>
        </select>
      </div>
      <div>
        <label><strong>Comments (optional)</strong></label><br/>
        <textarea name="comments" rows={3} placeholder="Notes or context" />
      </div>
      <button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Submit'}</button>
    </form>
  );
}
