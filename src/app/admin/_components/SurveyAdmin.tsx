'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type SurveyVersion = {
  id: string;
  name: string;
  description: string | null;
  is_live: boolean;
  created_at: string;
  updated_at: string;
};

type SurveyQuestion = {
  id: string;
  prompt: string;
  sort_order: number;
};

type SurveyResponse = {
  question_id: string;
  selected_initials: string[] | null;
  respondent_initials: string;
  response_date: string;
};

type RosterRow = { initials: string; full_name: string | null };

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function SurveyAdmin() {
  const [versions, setVersions] = useState<SurveyVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);

  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [editVersionName, setEditVersionName] = useState('');
  const [editVersionDescription, setEditVersionDescription] = useState('');

  const [newQuestionPrompt, setNewQuestionPrompt] = useState('');

  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(today());

  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function ensureSchema() {
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/admin/bootstrap-survey', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        console.error('Failed to bootstrap survey schema', res.status, body);
        setMsg('Unable to prepare survey tables. Please check server logs.');
      }
    } catch (err) {
      console.error('Failed to bootstrap survey schema', err);
      setMsg('Unable to prepare survey tables. Please check server logs.');
    }
  }

  useEffect(() => {
    void (async () => {
      await ensureSchema();
      await Promise.all([loadVersions(), loadRoster()]);
    })();
  }, []);

  useEffect(() => {
    const selected = versions.find((v) => v.id === selectedVersionId) ?? null;
    if (selected) {
      setEditVersionName(selected.name);
      setEditVersionDescription(selected.description ?? '');
    }
  }, [selectedVersionId, versions]);

  useEffect(() => {
    if (selectedVersionId) {
      void loadQuestions(selectedVersionId);
    } else {
      setQuestions([]);
    }
  }, [selectedVersionId]);

  useEffect(() => {
    if (selectedVersionId) {
      void loadReport(selectedVersionId, from, to);
    } else {
      setResponses([]);
    }
  }, [selectedVersionId, from, to]);

  async function loadRoster() {
    const { data } = await supabaseBrowser
      .from('roster')
      .select('initials, full_name')
      .order('initials');
    setRoster(data ?? []);
  }

  async function loadVersions() {
    setLoadingVersions(true);
    setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('survey_versions')
      .select('id, name, description, is_live, created_at, updated_at')
      .order('created_at', { ascending: true });
    if (error) {
      setMsg(error.message);
    } else {
      const list = (data as SurveyVersion[]) ?? [];
      setVersions(list);
      if (!selectedVersionId) {
        const live = list.find((v) => v.is_live);
        setSelectedVersionId(live?.id ?? list[0]?.id ?? null);
      }
    }
    setLoadingVersions(false);
  }

  async function loadQuestions(versionId: string) {
    setLoadingQuestions(true);
    setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('survey_questions')
      .select('id, prompt, sort_order')
      .eq('version_id', versionId)
      .order('sort_order', { ascending: true });
    if (error) {
      setMsg(error.message);
      setQuestions([]);
    } else {
      setQuestions((data as SurveyQuestion[]) ?? []);
    }
    setLoadingQuestions(false);
  }

  async function loadReport(versionId: string, fromDate: string, toDate: string) {
    setLoadingReport(true);
    setMsg(null);
    let query = supabaseBrowser
      .from('survey_responses')
      .select('question_id, selected_initials, respondent_initials, response_date')
      .eq('version_id', versionId)
      .order('response_date', { ascending: true })
      .limit(50000);
    if (fromDate) {
      query = query.gte('response_date', fromDate);
    }
    if (toDate) {
      query = query.lte('response_date', toDate);
    }
    const { data, error } = await query;
    if (error) {
      setMsg(error.message);
      setResponses([]);
    } else {
      setResponses((data as SurveyResponse[]) ?? []);
    }
    setLoadingReport(false);
  }

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId],
  );

  async function createVersion(e: FormEvent) {
    e.preventDefault();
    if (!newVersionName.trim()) return;
    setMsg(null);
    const payload = {
      name: newVersionName.trim(),
      description: newVersionDescription.trim() || null,
    };
    const { data, error } = await supabaseBrowser
      .from('survey_versions')
      .insert(payload)
      .select('id, name, description, is_live, created_at, updated_at')
      .single();
    if (error) {
      setMsg(error.message);
      return;
    }
    setVersions((prev) => [...prev, data as SurveyVersion]);
    setSelectedVersionId((data as SurveyVersion).id);
    setNewVersionName('');
    setNewVersionDescription('');
  }

  async function saveVersionDetails() {
    if (!selectedVersion) return;
    setMsg(null);
    const updates = {
      name: editVersionName.trim() || 'Untitled Survey',
      description: editVersionDescription.trim() || null,
    };
    const { error } = await supabaseBrowser
      .from('survey_versions')
      .update(updates)
      .eq('id', selectedVersion.id);
    if (error) {
      setMsg(error.message);
      return;
    }
    setVersions((prev) =>
      prev.map((v) => (v.id === selectedVersion.id ? { ...v, ...updates } : v)),
    );
    setMsg('Survey version saved.');
    setTimeout(() => setMsg(null), 2000);
  }

  async function setVersionLive(id: string) {
    setMsg(null);
    await supabaseBrowser
      .from('survey_versions')
      .update({ is_live: false })
      .neq('id', id);
    const { error } = await supabaseBrowser
      .from('survey_versions')
      .update({ is_live: true })
      .eq('id', id);
    if (error) {
      setMsg(error.message);
      return;
    }
    setVersions((prev) =>
      prev.map((v) => ({ ...v, is_live: v.id === id })),
    );
    setMsg('Live version updated.');
    setTimeout(() => setMsg(null), 2000);
  }

  async function addQuestion(e: FormEvent) {
    e.preventDefault();
    if (!selectedVersion || !newQuestionPrompt.trim()) return;
    setMsg(null);
    const sortOrder = (questions[questions.length - 1]?.sort_order ?? 0) + 1;
    const payload = {
      version_id: selectedVersion.id,
      prompt: newQuestionPrompt.trim(),
      sort_order: sortOrder,
    };
    const { data, error } = await supabaseBrowser
      .from('survey_questions')
      .insert(payload)
      .select('id, prompt, sort_order')
      .single();
    if (error) {
      setMsg(error.message);
      return;
    }
    setQuestions((prev) => [...prev, data as SurveyQuestion]);
    setNewQuestionPrompt('');
  }

  function updateQuestionPrompt(id: string, prompt: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, prompt } : q)),
    );
  }

  async function saveQuestion(id: string) {
    const q = questions.find((item) => item.id === id);
    if (!q) return;
    setMsg(null);
    const { error } = await supabaseBrowser
      .from('survey_questions')
      .update({ prompt: q.prompt.trim() || 'Untitled question' })
      .eq('id', id);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg('Question saved.');
    setTimeout(() => setMsg(null), 2000);
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Delete this question? Responses will also be removed.')) return;
    setMsg(null);
    const { error } = await supabaseBrowser
      .from('survey_questions')
      .delete()
      .eq('id', id);
    if (error) {
      setMsg(error.message);
      return;
    }
    const remaining = questions.filter((q) => q.id !== id);
    setQuestions(remaining);
    await persistSortOrder(remaining);
  }

  async function moveQuestion(id: string, direction: -1 | 1) {
    const index = questions.findIndex((q) => q.id === id);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const [item] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, item);
    setQuestions(updated);
    await persistSortOrder(updated);
  }

  async function persistSortOrder(updated: SurveyQuestion[]) {
    try {
      await Promise.all(
        updated.map((q, idx) =>
          supabaseBrowser
            .from('survey_questions')
            .update({ sort_order: idx + 1 })
            .eq('id', q.id),
        ),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update order.';
      setMsg(message);
    }
  }

  const providerName = useMemo(() => {
    const map: Record<string, string> = {};
    roster.forEach((row) => {
      if (row.initials) {
        map[row.initials] = row.full_name ?? row.initials;
      }
    });
    return map;
  }, [roster]);

  const aggregated = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    responses.forEach((res) => {
      const list = res.selected_initials ?? [];
      if (!out[res.question_id]) out[res.question_id] = {};
      list.forEach((initials) => {
        out[res.question_id][initials] = (out[res.question_id][initials] ?? 0) + 1;
      });
    });
    return out;
  }, [responses]);

  const completionsByQuestion = useMemo(() => {
    const map: Record<string, number> = {};
    responses.forEach((res) => {
      map[res.question_id] = (map[res.question_id] ?? 0) + 1;
    });
    return map;
  }, [responses]);

  function downloadCSV() {
    if (!responses.length || !selectedVersion) return;
    const headers = ['response_date', 'respondent_initials', 'question_prompt', 'selected_initials'];
    const questionMap: Record<string, string> = {};
    questions.forEach((q) => {
      questionMap[q.id] = q.prompt;
    });
    const lines = [headers.join(',')];
    responses.forEach((row) => {
      const vals = [
        row.response_date,
        row.respondent_initials,
        questionMap[row.question_id] ?? row.question_id,
        (row.selected_initials ?? []).join('|'),
      ];
      const escaped = vals.map((v) => {
        const str = String(v ?? '').replace(/"/g, '""');
        return `"${str}"`;
      });
      lines.push(escaped.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedVersion.name.replace(/\s+/g, '_').toLowerCase()}_${from || 'all'}_${to || 'all'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Hospitalist Survey</h2>
        <button className="btn btn-secondary" onClick={loadVersions} disabled={loadingVersions}>
          {loadingVersions ? 'Refreshing…' : 'Refresh Versions'}
        </button>
      </div>

      <div className="card space-y-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={createVersion}>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs mb-1">New version name</label>
            <input
              className="input w-full"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              placeholder="e.g. FY25 Baseline"
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs mb-1">Description (optional)</label>
            <input
              className="input w-full"
              value={newVersionDescription}
              onChange={(e) => setNewVersionDescription(e.target.value)}
              placeholder="Highlights or notes"
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Create Version
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {versions.map((version) => (
            <button
              key={version.id}
              onClick={() => setSelectedVersionId(version.id)}
              className={`btn ${selectedVersionId === version.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {version.name}
              {version.is_live && (
                <span className="ml-2 rounded bg-green-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-900">
                  Live
                </span>
              )}
            </button>
          ))}
          {!versions.length && <p className="text-sm text-gray-600">No survey versions yet. Create one above.</p>}
        </div>
      </div>

      {selectedVersion && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs mb-1">Version name</label>
                <input
                  className="input w-full"
                  value={editVersionName}
                  onChange={(e) => setEditVersionName(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs mb-1">Description</label>
                <input
                  className="input w-full"
                  value={editVersionDescription}
                  onChange={(e) => setEditVersionDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-2 ml-auto">
                <button className="btn btn-secondary" type="button" onClick={saveVersionDetails}>
                  Save details
                </button>
                {!selectedVersion.is_live && (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => setVersionLive(selectedVersion.id)}
                  >
                    Make Live
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Updated {new Date(selectedVersion.updated_at).toLocaleString()}
            </p>
          </div>

          <div className="card space-y-4">
            <h3 className="text-lg font-medium">Questions ({questions.length})</h3>

            <form className="flex flex-wrap items-end gap-3" onSubmit={addQuestion}>
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs mb-1">Question prompt</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={newQuestionPrompt}
                  onChange={(e) => setNewQuestionPrompt(e.target.value)}
                  placeholder="Describe what you want respondents to evaluate"
                />
              </div>
              <button className="btn btn-primary" type="submit">
                Add question
              </button>
            </form>

            {loadingQuestions && <p className="text-sm text-gray-600">Loading questions…</p>}

            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 text-xs font-semibold text-gray-500">#{idx + 1}</span>
                    <textarea
                      className="input flex-1"
                      rows={2}
                      value={q.prompt}
                      onChange={(e) => updateQuestionPrompt(q.id, e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary"
                        onClick={() => moveQuestion(q.id, -1)}
                        disabled={idx === 0}
                        type="button"
                      >
                        Move up
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => moveQuestion(q.id, 1)}
                        disabled={idx === questions.length - 1}
                        type="button"
                      >
                        Move down
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary" type="button" onClick={() => saveQuestion(q.id)}>
                        Save
                      </button>
                      <button className="btn btn-danger" type="button" onClick={() => deleteQuestion(q.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!questions.length && !loadingQuestions && (
                <p className="text-sm text-gray-600">No questions yet. Add your first question above.</p>
              )}
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs mb-1">From</label>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1">To</label>
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => selectedVersionId && loadReport(selectedVersionId, from, to)}
              >
                Refresh report
              </button>
              <button className="btn btn-primary" type="button" onClick={downloadCSV} disabled={!responses.length}>
                Download CSV
              </button>
              {loadingReport && <span className="text-xs text-gray-500">Loading responses…</span>}
            </div>

            {questions.map((q) => {
              const counts = aggregated[q.id] ?? {};
              const totalSelections = Object.values(counts).reduce((sum, val) => sum + val, 0);
              const completions = completionsByQuestion[q.id] ?? 0;
              const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              return (
                <div key={q.id} className="space-y-2 border-t border-gray-200 pt-4 first:border-t-0 first:pt-0">
                  <div>
                    <h4 className="text-base font-semibold">{q.prompt}</h4>
                    <p className="text-xs text-gray-500">
                      {completions} responses · {totalSelections} total selections
                    </p>
                  </div>
                  {entries.length ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Provider</th>
                            <th>Selections</th>
                            <th>% of responses</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map(([initials, count]) => (
                            <tr key={initials}>
                              <td>
                                <div className="font-medium">{initials}</div>
                                <div className="text-xs text-gray-500">{providerName[initials] ?? ''}</div>
                              </td>
                              <td>{count}</td>
                              <td>{completions ? ((count / completions) * 100).toFixed(1) + '%' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No selections recorded for this question in the chosen window.</p>
                  )}
                </div>
              );
            })}
            {!questions.length && <p className="text-sm text-gray-600">Add questions to see survey analytics.</p>}
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </section>
  );
}
