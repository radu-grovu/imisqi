'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

function today() {
  return new Date().toISOString().slice(0, 10);
}

type RosterRow = { initials: string; full_name: string; active: boolean };
type SurveyVersion = { id: string; name: string; description: string | null };
type SurveyQuestion = { id: string; prompt: string; sort_order: number };
type SurveyResponseRow = {
  question_id: string;
  selected_initials: string[] | null;
};

export default function HospitalistSurveyPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [myInitials, setMyInitials] = useState<string>('');
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [date, setDate] = useState<string>(today());
  const [started, setStarted] = useState(false);
  const [activeVersion, setActiveVersion] = useState<SurveyVersion | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace('/auth/login');
        return;
      }

      const user = data.session.user;
      setUserId(user.id);

      const [{ data: prof }, { data: ros }, { data: version }] = await Promise.all([
        supabaseBrowser
          .from('profiles')
          .select('initials')
          .eq('id', user.id)
          .maybeSingle(),
        supabaseBrowser
          .from('roster')
          .select('initials, full_name, active')
          .eq('active', true)
          .order('initials'),
        supabaseBrowser
          .from('survey_versions')
          .select('id, name, description')
          .eq('is_live', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setMyInitials((prof?.initials ?? '').toUpperCase());
      setRoster(ros ?? []);

      if (version) {
        setActiveVersion(version as SurveyVersion);
        const { data: qs } = await supabaseBrowser
          .from('survey_questions')
          .select('id, prompt, sort_order')
          .eq('version_id', version.id)
          .order('sort_order', { ascending: true });
        setQuestions((qs as SurveyQuestion[]) ?? []);
      } else {
        setActiveVersion(null);
        setQuestions([]);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (started && userId && activeVersion) {
      void loadResponses(userId, activeVersion.id, date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, userId, activeVersion?.id, date]);

  async function loadResponses(uid: string, versionId: string, onDate: string) {
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('survey_responses')
      .select('question_id, selected_initials')
      .eq('respondent_id', uid)
      .eq('version_id', versionId)
      .eq('response_date', onDate);
    if (error) {
      setMsg(error.message);
    }
    const mapped: Record<string, string[]> = {};
    (data as SurveyResponseRow[] | null)?.forEach((row) => {
      mapped[row.question_id] = [...(row.selected_initials ?? [])].sort();
    });
    setAnswers(mapped);
    setLoading(false);
  }

  function beginSurvey() {
    if (!userId || !activeVersion) return;
    setStarted(true);
    setCurrentIndex(0);
    void loadResponses(userId, activeVersion.id, date);
  }

  const currentQuestion = questions[currentIndex] ?? null;
  const selectedInitials = useMemo(() => {
    if (!currentQuestion) return new Set<string>();
    return new Set(answers[currentQuestion.id] ?? []);
  }, [answers, currentQuestion]);

  function toggleInitials(initials: string) {
    if (!currentQuestion) return;
    setAnswers((prev) => {
      const existing = new Set(prev[currentQuestion.id] ?? []);
      if (existing.has(initials)) {
        existing.delete(initials);
      } else {
        existing.add(initials);
      }
      const updated = [...existing].sort();
      return { ...prev, [currentQuestion.id]: updated };
    });
  }

  async function saveCurrentQuestion() {
    if (!userId || !activeVersion || !currentQuestion) return;
    setSaving(true);
    setMsg(null);
    const selections = answers[currentQuestion.id] ?? [];
    if (!selections.length) {
      const { error } = await supabaseBrowser
        .from('survey_responses')
        .delete()
        .eq('respondent_id', userId)
        .eq('version_id', activeVersion.id)
        .eq('question_id', currentQuestion.id)
        .eq('response_date', date);
      if (error) {
        setMsg(error.message);
      } else {
        setMsg('Cleared response.');
      }
    } else {
      const payload = {
        respondent_id: userId,
        respondent_initials: myInitials || '??',
        version_id: activeVersion.id,
        question_id: currentQuestion.id,
        response_date: date,
        selected_initials: selections,
      };
      const { error } = await supabaseBrowser
        .from('survey_responses')
        .upsert(payload, {
          onConflict: 'respondent_id,question_id,response_date',
        });
      if (error) {
        setMsg(error.message);
      } else {
        setMsg('Saved.');
      }
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 2000);
  }

  function goPrev() {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }

  function goNext() {
    setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
  }

  const completion = useMemo(() => {
    if (!questions.length) return 0;
    const answered = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;
    return Math.round((answered / questions.length) * 100);
  }, [answers, questions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          Hospitalist Survey
          <span className="inline-flex items-center rounded bg-yellow-200 px-2 py-0.5 text-xs font-semibold text-yellow-800">
            BETA
          </span>
        </h1>
        {activeVersion && (
          <p className="text-sm text-gray-600">
            {activeVersion.name}
            {activeVersion.description ? ` · ${activeVersion.description}` : ''}
          </p>
        )}
      </div>

      {!activeVersion && (
        <div className="card">
          <p className="text-sm text-gray-700">
            No active survey has been published yet. Please contact an administrator.
          </p>
        </div>
      )}

      {activeVersion && (
        <div className="card flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs mb-1">Survey Date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={beginSurvey} disabled={!questions.length}>
            {started ? 'Reload Responses' : 'Start Survey'}
          </button>
          {!!questions.length && (
            <div className="ml-auto text-xs text-gray-600">{completion}% of questions answered</div>
          )}
        </div>
      )}

      {started && activeVersion && (
        <div className="space-y-4">
          {!questions.length && (
            <div className="card">
              <p className="text-sm text-gray-600">No questions are available in this survey.</p>
            </div>
          )}

          {questions.length > 0 && currentQuestion && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Question {currentIndex + 1} of {questions.length}</p>
                  <h2 className="text-xl font-semibold">{currentQuestion.prompt}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-secondary" onClick={goPrev} disabled={currentIndex === 0}>
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={goNext}
                    disabled={currentIndex === questions.length - 1}
                  >
                    Next
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Select all providers who match this prompt. Leave blank if nobody meets the criteria.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {roster
                  .filter((r) => r.initials !== myInitials)
                  .map((member) => {
                    const isSelected = selectedInitials.has(member.initials);
                    return (
                      <button
                        key={member.initials}
                        type="button"
                        onClick={() => toggleInitials(member.initials)}
                        className={`rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-200 ${
                          isSelected
                            ? 'border-green-500 bg-green-100 text-green-900'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                        title={member.full_name}
                      >
                        <div className="text-lg font-semibold">{member.initials}</div>
                        <div className="text-xs text-gray-600">{member.full_name}</div>
                      </button>
                    );
                  })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2 text-sm text-gray-700">
                  {Array.from(selectedInitials).length > 0 ? (
                    Array.from(selectedInitials).map((initials) => (
                      <span
                        key={initials}
                        className="inline-flex items-center rounded-full bg-green-200 px-2 py-0.5 text-xs font-semibold text-green-900"
                      >
                        {initials}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">No providers selected.</span>
                  )}
                </div>
                <button className="btn btn-primary" onClick={saveCurrentQuestion} disabled={saving || loading}>
                  {saving ? 'Saving…' : 'Save Response'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-gray-600">Loading responses…</p>}
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
