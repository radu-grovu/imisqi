'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type SurveyVersion = {
  id: string;
  name: string;
  description: string | null;
};

type SurveyQuestion = {
  id: string;
  prompt: string;
  sort_order: number;
};

type SurveyResponseRow = {
  question_id: string;
  selected_initials: string[] | null;
};

type RosterRow = {
  initials: string;
  full_name: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function HospitalistSurveyPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [myInitials, setMyInitials] = useState('');
  const [date, setDate] = useState(today());

  const [version, setVersion] = useState<SurveyVersion | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);

  const [responses, setResponses] = useState<Record<string, string[]>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [loadingScaffold, setLoadingScaffold] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace('/auth/login');
        return;
      }
      setUserId(data.session.user.id);
      const { data: prof } = await supabaseBrowser
        .from('profiles')
        .select('initials')
        .eq('id', data.session.user.id)
        .maybeSingle();
      setMyInitials((prof?.initials ?? '').toUpperCase());
    })();
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    void loadSurveyShell();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId || !version) return;
    void loadResponses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, version, date]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [date, version?.id]);

  const activeQuestion = questions[currentIndex] ?? null;

  async function loadSurveyShell() {
    setLoadingScaffold(true);
    setError(null);
    setMessage(null);
    try {
      const versionResult = await supabaseBrowser
        .from('survey_versions')
        .select('id, name, description')
        .eq('is_live', true)
        .maybeSingle();

      if (versionResult.error) {
        throw versionResult.error;
      }

      const liveVersion = versionResult.data as SurveyVersion | null;
      if (!liveVersion) {
        setVersion(null);
        setQuestions([]);
        setRoster([]);
        setResponses({});
        setLoadingScaffold(false);
        setError('No hospitalist survey is live yet. Please check back later.');
        return;
      }

      setVersion(liveVersion);

      const [questionResult, rosterResult] = await Promise.all([
        supabaseBrowser
          .from('survey_questions')
          .select('id, prompt, sort_order')
          .eq('version_id', liveVersion.id)
          .order('sort_order', { ascending: true }),
        supabaseBrowser
          .from('roster')
          .select('initials, full_name')
          .eq('active', true)
          .order('initials'),
      ]);

      if (questionResult.error) {
        throw questionResult.error;
      }
      const allQuestions = (questionResult.data as SurveyQuestion[] | null) ?? [];
      setQuestions(allQuestions);

      if (rosterResult.error) {
        throw rosterResult.error;
      }
      const rosterRows = (rosterResult.data as RosterRow[] | null) ?? [];
      setRoster(rosterRows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load survey.';
      if (message.includes("Could not find the table 'public.survey_versions'")) {
        setError('Hospitalist survey is not configured yet. Please contact an administrator.');
      } else {
        setError(message);
      }
      setError(message);
    } finally {
      setLoadingScaffold(false);
    }
  }

  async function loadResponses() {
    if (!userId || !version) return;
    setLoadingResponses(true);
    setError(null);
    try {
      const { data, error: respError } = await supabaseBrowser
        .from('survey_responses')
        .select('question_id, selected_initials')
        .eq('respondent_id', userId)
        .eq('version_id', version.id)
        .eq('response_date', date);
      if (respError) throw respError;
      const map: Record<string, string[]> = {};
      (data as SurveyResponseRow[] | null)?.forEach((row) => {
        map[row.question_id] = [...(row.selected_initials ?? [])];
      });
      setResponses(map);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load your responses.';
      if (message.includes("Could not find the table 'public.survey_responses'")) {
        setError('Hospitalist survey storage is not ready yet. Please try again after an administrator opens the admin survey tab.');
      } else {
        setError(message);
      }
      setError(message);
    } finally {
      setLoadingResponses(false);
    }
  }

  function toggleSelection(questionId: string, initials: string) {
    setResponses((prev) => {
      const current = new Set(prev[questionId] ?? []);
      if (current.has(initials)) {
        current.delete(initials);
      } else {
        current.add(initials);
      }
      return { ...prev, [questionId]: Array.from(current) };
    });
  }

  function clearSelections(questionId: string) {
    setResponses((prev) => ({ ...prev, [questionId]: [] }));
  }

  async function saveSurvey() {
    if (!userId || !version) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = questions.map((q) => ({
        version_id: version.id,
        question_id: q.id,
        respondent_id: userId,
        respondent_initials: myInitials,
        response_date: date,
        selected_initials: (responses[q.id] ?? []).length ? responses[q.id] : null,
      }));
      if (!payload.length) {
        setMessage('No questions to save.');
        return;
      }
      const { error: upsertError } = await supabaseBrowser
        .from('survey_responses')
        .upsert(payload, {
          onConflict: 'version_id,question_id,respondent_id,response_date',
        });
      if (upsertError) throw upsertError;
      setMessage('Survey saved for this date.');
      setTimeout(() => setMessage(null), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to save responses.';
      if (message.includes("Could not find the table 'public.survey_responses'")) {
        setError('Hospitalist survey storage is not ready yet. Please try again after an administrator opens the admin survey tab.');
      } else {
        setError(message);
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const providerLookup = useMemo(() => {
    const map: Record<string, string> = {};
    roster.forEach((row) => {
      if (row.initials) {
        map[row.initials] = row.full_name ?? row.initials;
      }
    });
    return map;
  }, [roster]);

  const totalQuestions = questions.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hospitalist Survey</h1>
        <p className="text-sm text-gray-600">
          Select the providers who meet each prompt. Your responses are saved per day so you can revisit and update them.
        </p>
      </div>

      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs mb-1">Survey date</label>
          <input
            type="date"
            className="input"
            value={date}
            max={today()}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        {version && (
          <div className="text-sm text-gray-600">
            <div className="font-medium text-gray-700">Active version</div>
            <div>{version.name}</div>
            {version.description && <div className="text-xs text-gray-500">{version.description}</div>}
          </div>
        )}
        <button
          className="btn btn-primary ml-auto"
          type="button"
          onClick={saveSurvey}
          disabled={saving || !totalQuestions}
        >
          {saving ? 'Saving…' : 'Save responses'}
        </button>
      </div>

      {loadingScaffold && <div className="card">Loading survey…</div>}

      {!loadingScaffold && error && (
        <div className="card border border-red-200 bg-red-50 text-red-800">{error}</div>
      )}

      {!loadingScaffold && !error && !version && (
        <div className="card">No live survey is available yet.</div>
      )}

      {!loadingScaffold && version && !totalQuestions && (
        <div className="card">The current survey does not have any questions yet.</div>
      )}

      {!loadingScaffold && version && totalQuestions > 0 && activeQuestion && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Question {currentIndex + 1} of {totalQuestions}
                </p>
                <h2 className="text-lg font-semibold text-gray-900">{activeQuestion.prompt}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => clearSelections(activeQuestion.id)}
                  disabled={!(responses[activeQuestion.id]?.length)}
                >
                  Clear selections
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => void loadResponses()}
                  disabled={loadingResponses}
                >
                  {loadingResponses ? 'Refreshing…' : 'Load saved'}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Tap a provider to toggle whether they meet the prompt. Leave blank if nobody applies.
            </p>
          </div>

          <div className="card">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {roster
                .filter((person) => person.initials && person.initials !== myInitials)
                .map((person) => {
                  const selections = responses[activeQuestion.id] ?? [];
                  const selected = selections.includes(person.initials);
                  return (
                    <button
                      key={person.initials}
                      type="button"
                      className={`rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                        selected
                          ? 'border-brand-500 bg-brand-100 text-brand-900 shadow-soft'
                          : 'border-gray-200 bg-white hover:border-brand-300'
                      }`}
                      onClick={() => toggleSelection(activeQuestion.id, person.initials)}
                    >
                      <div className="text-lg font-semibold">{person.initials}</div>
                      <div className="text-xs text-gray-600">{providerLookup[person.initials] ?? ''}</div>
                    </button>
                  );
                })}
            </div>
            {!roster.length && (
              <p className="text-sm text-gray-600">No active providers found in the roster.</p>
            )}
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              {responses[activeQuestion.id]?.length ? (
                <span>
                  Selected providers: {responses[activeQuestion.id].join(', ')}
                </span>
              ) : (
                <span>No providers selected for this question.</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
                disabled={currentIndex === 0}
              >
                Previous question
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  setCurrentIndex((idx) =>
                    Math.min(totalQuestions - 1, idx + 1),
                  )
                }
                disabled={currentIndex === totalQuestions - 1}
              >
                Next question
              </button>
            </div>
          </div>
        </div>
      )}

      {message && !error && (
        <p className="text-sm text-green-700">{message}</p>
      )}
    </div>
  );
}
