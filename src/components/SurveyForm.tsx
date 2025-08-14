'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../lib/supabaseBrowser';

/**
 * Props:
 *  - date: 'YYYY-MM-DD' (string)
 *  - campaignId?: string  (optional; we omit it when saving for no-campaign flow)
 */
interface SurveyFormProps {
  date: string;
  campaignId?: string;
}

type Reason =
  | 'Consult delay'
  | 'Imaging scheduling'
  | 'Procedure scheduling'
  | 'Lab results pending'
  | 'Bed availability / placement'
  | 'Insurance authorization'
  | 'Transport'
  | 'Documentation / discharge paperwork'
  | 'SNF/rehab acceptance'
  | 'Medication access'
  | 'Other';

const REASONS: Reason[] = [
  'Consult delay',
  'Imaging scheduling',
  'Procedure scheduling',
  'Lab results pending',
  'Bed availability / placement',
  'Insurance authorization',
  'Transport',
  'Documentation / discharge paperwork',
  'SNF/rehab acceptance',
  'Medication access',
  'Other',
];

type PatientDelay = {
  id: string;            // local uid
  label: string;         // optional (defaults to "Patient N")
  reason: Reason | '';
  otherReason?: string;  // when reason === 'Other'
  comment?: string;      // optional
};

export default function SurveyForm({ date, campaignId }: SurveyFormProps) {
  const [profileId, setProfileId] = useState<string | null>(null);

  // dynamic patients list
  const [patients, setPatients] = useState<PatientDelay[]>([]);
  const [generalComments, setGeneralComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // get the logged-in user's profile id (same as auth.user.id)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (mounted) setProfileId(uid);
    })();
    return () => { mounted = false; };
  }, []);

  // helpers
  function addPatient() {
    setPatients(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: '',
        reason: '',
        otherReason: '',
        comment: '',
      },
    ]);
  }
  function removePatient(id: string) {
    setPatients(prev => prev.filter(p => p.id !== id));
  }
  function updatePatient(id: string, patch: Partial<PatientDelay>) {
    setPatients(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  }

  const totalDelayed = patients.length;

  const normalizedPatients = useMemo(() => {
    return patients.map((p, idx) => ({
      ...p,
      label: p.label?.trim() ? p.label.trim() : `Patient ${idx + 1}`,
    }));
  }, [patients]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!profileId) {
      setMsg('You must be signed in to submit.');
      return;
    }

    // basic per-row validation
    for (const p of normalizedPatients) {
      if (!p.reason) {
        setMsg(`${p.label}: please select a reason.`);
        return;
      }
      if (p.reason === 'Other' && !p.otherReason?.trim()) {
        setMsg(`${p.label}: please enter the "Other" reason.`);
        return;
      }
    }

    const payload = {
      total_delayed: totalDelayed,
      patients: normalizedPatients.map(p => ({
        label: p.label,
        reason: p.reason === 'Other' ? p.otherReason : p.reason,
        comment: p.comment?.trim() || null,
      })),
      general_comments: generalComments.trim() || null,
    };

    setSubmitting(true);
    try {
      // Build the row conforming to the existing schema
      const row: Record<string, any> = {
        profile_id: profileId,     // FK to public.profiles(id)
        survey_date: date,         // Postgres will cast 'YYYY-MM-DD' to date
        answers: payload,          // jsonb
        // submitted_at has a default; let DB set it
      };
      // Only include campaign_id if provided (nullable column)
      if (campaignId) row.campaign_id = campaignId;

      const { error } = await supabaseBrowser
        .from('responses')
        .upsert(row, { onConflict: 'profile_id,survey_date' });

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
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <strong>Number of patients delayed: {totalDelayed}</strong>
          <button type="button" onClick={addPatient} style={{ padding: '6px 10px' }}>
            + Add patient
          </button>
        </div>

        {patients.length === 0 && (
          <p style={{ color: '#555' }}>Click “+ Add patient” to start.</p>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {patients.map((p, idx) => (
            <div key={p.id} style={{ border: '1px solid #e5e5e5', padding: 12, borderRadius: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder={`Label (optional, e.g., Patient ${idx + 1})`}
                  value={p.label}
                  onChange={(e) => updatePatient(p.id, { label: e.target.value })}
                  style={{ flex: 1, padding: 8 }}
                />
                <button type="button" onClick={() => removePatient(p.id)} style={{ padding: '6px 10px' }}>
                  Remove
                </button>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <label>
                  <div style={{ marginBottom: 4 }}>Reason for delay</div>
                  <select
                    value={p.reason}
                    onChange={(e) => updatePatient(p.id, { reason: e.target.value as Reason })}
                    required
                    style={{ padding: 8, width: '100%' }}
                  >
                    <option value="">Select…</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>

                {p.reason === 'Other' && (
                  <input
                    type="text"
                    placeholder="Describe the reason"
                    value={p.otherReason}
                    onChange={(e) => updatePatient(p.id, { otherReason: e.target.value })}
                    style={{ padding: 8 }}
                    required
                  />
                )}

                <label>
                  <div style={{ marginBottom: 4 }}>Comment (optional)</div>
                  <textarea
                    rows={2}
                    value={p.comment || ''}
                    onChange={(e) => updatePatient(p.id, { comment: e.target.value })}
                    style={{ padding: 8, width: '100%' }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <label>
          <div style={{ marginBottom: 4 }}>General comments (optional)</div>
          <textarea
            rows={3}
            value={generalComments}
            onChange={(e) => setGeneralComments(e.target.value)}
            style={{ padding: 8, width: '100%' }}
          />
        </label>
      </section>

      <div>
        <button type="submit" disabled={submitting} style={{ padding: '10px 14px', fontSize: 16 }}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
        {msg && (
          <p style={{ marginTop: 8, color: msg.startsWith('Saved') ? 'green' : 'crimson' }}>
            {msg}
          </p>
        )}
      </div>
    </form>
  );
}
