'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../lib/supabaseBrowser';

interface SurveyFormProps {
  date: string;           // YYYY-MM-DD
  campaignId?: string;    // optional; unused for self-serve flow
}

type ReasonCategory =
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

const SUBREASONS: Record<ReasonCategory, string[]> = {
  'Consult delay': [
    'Cardiology','Gastroenterology','Pulmonology','Nephrology','Neurology',
    'General Surgery','Psychiatry','Infectious Disease','Hematology/Oncology',
    'Endocrinology','Palliative Care','Urology','Orthopedics','Other'
  ],
  'Imaging scheduling': [
    'MRI','CT','Ultrasound','X-ray','Echocardiogram','Nuclear medicine','Interventional radiology','Other'
  ],
  'Procedure scheduling': [
    'Endoscopy','Bronchoscopy','Paracentesis','Thoracentesis','Biopsy',
    'Cardiac catheterization','EP/Pacemaker','OR / General Surgery','IR procedure','Other'
  ],
  'Lab results pending': [
    'Send-out test','Pathology report','Blood culture final','Microbiology','Genetics','Other'
  ],
  'Bed availability / placement': [
    'Floor bed','Stepdown','ICU','Telemetry','Psych','Other'
  ],
  'Insurance authorization': [
    'Inpatient auth','Imaging auth','Procedure auth','Post-acute auth (SNF/HH)','Medication auth','Other'
  ],
  Transport: [
    'Internal transport','External ambulance','Patient transport service','Other'
  ],
  'Documentation / discharge paperwork': [
    'AVS / discharge instructions','Discharge summary','Prescriptions','Follow-up appointments','Case management paperwork','Other'
  ],
  'SNF/rehab acceptance': [
    'Facility pending','No weekend admissions','Insurance pending','Other'
  ],
  'Medication access': [
    'Prior authorization','Specialty pharmacy','Non-formulary','Financial assistance','Other'
  ],
  Other: ['Other'],
};

type PatientDelay = {
  id: string;
  label: string;                // optional, default “Patient N”
  reasonCategory: ReasonCategory | '';
  reasonDetail: string;         // one of SUBREASONS[category] or free-text if "Other"
  otherText?: string;           // only shown when detail === 'Other' or category === 'Other'
  comment?: string;             // optional
};

export default function SurveyForm({ date, campaignId }: SurveyFormProps) {
  const [profileId, setProfileId] = useState<string | null>(null);

  const [patients, setPatients] = useState<PatientDelay[]>([]);
  const [generalComments, setGeneralComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // get logged-in user id
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (mounted) setProfileId(uid);
    })();
    return () => { mounted = false; };
  }, []);

  function addPatient() {
    setPatients(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: '',
        reasonCategory: '',
        reasonDetail: '',
        otherText: '',
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

    // validation
    for (const p of normalizedPatients) {
      if (!p.reasonCategory) {
        setMsg(`${p.label}: select a reason category.`);
        return;
      }
      const needsDetail = SUBREASONS[p.reasonCategory] && SUBREASONS[p.reasonCategory].length > 0;
      if (needsDetail && !p.reasonDetail) {
        setMsg(`${p.label}: select a detailed reason.`);
        return;
      }
      const requiresText = p.reasonCategory === 'Other' || p.reasonDetail === 'Other';
      if (requiresText && !p.otherText?.trim()) {
        setMsg(`${p.label}: describe the “Other” reason.`);
        return;
      }
    }

    const payload = {
      total_delayed: totalDelayed,
      patients: normalizedPatients.map((p) => ({
        label: p.label,
        reason_category: p.reasonCategory,
        reason_detail: p.reasonCategory === 'Other'
          ? (p.otherText?.trim() || 'Other')
          : (p.reasonDetail === 'Other'
              ? (p.otherText?.trim() || 'Other')
              : p.reasonDetail),
        comment: p.comment?.trim() || null,
      })),
      general_comments: generalComments.trim() || null,
    };

    setSubmitting(true);
    try {
      const row: Record<string, any> = {
        profile_id: profileId,
        survey_date: date,
        answers: payload,
      };
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

  // --- UI ---
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16, maxWidth: 780 }}>
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
          {patients.map((p, idx) => {
            const details = p.reasonCategory ? SUBREASONS[p.reasonCategory] : [];
            const showOtherText = p.reasonCategory === 'Other' || p.reasonDetail === 'Other';

            return (
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
                    <div style={{ marginBottom: 4 }}>Reason category</div>
                    <select
                      value={p.reasonCategory}
                      onChange={(e) =>
                        updatePatient(p.id, {
                          reasonCategory: e.target.value as ReasonCategory,
                          reasonDetail: '',
                          otherText: '',
                        })
                      }
                      required
                      style={{ padding: 8, width: '100%' }}
                    >
                      <option value="">Select category…</option>
                      {(Object.keys(SUBREASONS) as ReasonCategory[]).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </label>

                  {p.reasonCategory && SUBREASONS[p.reasonCategory].length > 0 && (
                    <label>
                      <div style={{ marginBottom: 4 }}>Detail</div>
                      <select
                        value={p.reasonDetail}
                        onChange={(e) => updatePatient(p.id, { reasonDetail: e.target.value })}
                        required
                        style={{ padding: 8, width: '100%' }}
                      >
                        <option value="">Select detail…</option>
                        {SUBREASONS[p.reasonCategory].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {showOtherText && (
                    <input
                      type="text"
                      placeholder="Describe the 'Other' reason"
                      value={p.otherText}
                      onChange={(e) => updatePatient(p.id, { otherText: e.target.value })}
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
            );
          })}
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
