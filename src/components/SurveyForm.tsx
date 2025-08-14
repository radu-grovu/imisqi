'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../lib/supabaseBrowser';

type Option = '' | 'day' | 'evening' | 'night';

interface SurveyFormProps {
  date: string;           // YYYY-MM-DD
  campaignId?: string;    // now optional
}

export default function SurveyForm({ date, campaignId }: SurveyFormProps) {
  const [shift, setShift] = useState<Option>('');
  const [delays, setDelays] = useState('');           // free text
  const [completed, setCompleted] = useState(false);  // e.g., finished notes/rounds, etc.
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Resolve an active campaign id or default to "manual"
  const activeCampaignId = campaignId ?? 'manual';

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (mounted) setUserId(data.session?.user?.id ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!userId) {
      setMsg('You must be signed in to submit the survey.');
      return;
    }
    if (!shift) {
      setMsg('Please select your shift.');
      return;
    }

    setSubmitting(true);
    try {
      // Save a single row per user/date; upsert avoids dupes if they re-submit
      const { error } = await supabaseBrowser
        .from('responses')
        .upsert(
          {
            user_id: userId,
            date,                                  // stored as date or text (YYYY-MM-DD)
            campaign_id: activeCampaignId,
            answers: {
              shift,
              delays,
              completed,
            },
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,date' } // requires a unique index on (user_id, date)
        );

      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg('Saved. Thank you!');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
      <label>
        <div style={{ marginBottom: 4 }}>Shift</div>
        <select
          value={shift}
          onCh
