'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type SurveyVersion = { id: string; name: string };
type SurveyQuestion = { id: string; prompt: string };
type SurveyResponse = {
  respondent_initials: string;
  response_date: string;
  selected_initials: string[] | null;
  question_id: string;
};

export default function SuperAdminSurveyPage() {
  const [isRG, setIsRG] = useState(false);
  const [versions, setVersions] = useState<SurveyVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<SurveyResponse[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabaseBrowser.auth.getSession();
      if (!sess.session) return;
      const { data: prof } = await supabaseBrowser
        .from('profiles')
        .select('initials')
        .eq('id', sess.session.user.id)
        .single();
      setIsRG((prof?.initials ?? '') === 'RG');
    })();
  }, []);

  useEffect(() => {
    if (!isRG) return;
    void loadVersions();
  }, [isRG]);

  async function loadVersions() {
    const { data } = await supabaseBrowser
      .from('survey_versions')
      .select('id, name, is_live')
      .order('created_at', { ascending: true });
    const list = (data as (SurveyVersion & { is_live?: boolean })[]) ?? [];
    setVersions(list);
    if (!selectedVersionId && list.length) {
      const live = list.find((v) => v.is_live);
      setSelectedVersionId(live?.id ?? list[0].id);
    }
  }

  useEffect(() => {
    if (!selectedVersionId) {
      setQuestions({});
      setRows([]);
      return;
    }
    void loadQuestions(selectedVersionId);
    void load(selectedVersionId, from, to);
  }, [selectedVersionId]);

  async function loadQuestions(versionId: string) {
    const { data } = await supabaseBrowser
      .from('survey_questions')
      .select('id, prompt')
      .eq('version_id', versionId)
      .order('sort_order', { ascending: true });
    const map: Record<string, string> = {};
    (data as SurveyQuestion[] | null)?.forEach((q) => {
      map[q.id] = q.prompt;
    });
    setQuestions(map);
  }

  async function load(versionId: string, fromDate: string, toDate: string) {
    setLoading(true);
    let query = supabaseBrowser
      .from('survey_responses')
      .select('respondent_initials, response_date, selected_initials, question_id')
      .eq('version_id', versionId)
      .order('response_date', { ascending: false })
      .limit(5000);
    if (fromDate) query = query.gte('response_date', fromDate);
    if (toDate) query = query.lte('response_date', toDate);
    const { data } = await query;
    setRows((data as SurveyResponse[]) ?? []);
    setLoading(false);
  }

  function handleLoad() {
    if (selectedVersionId) {
      void load(selectedVersionId, from, to);
    }
  }

  function downloadCSV() {
    if (!rows.length) return;
    const headers = ['response_date', 'respondent_initials', 'question_prompt', 'selected_initials'];
    const lines = [headers.join(',')];
    rows.forEach((row) => {
      const prompt = questions[row.question_id] ?? row.question_id;
      const selected = (row.selected_initials ?? []).join('|');
      const vals = [row.response_date, row.respondent_initials, prompt, selected];
      const escaped = vals.map((value) => {
        const str = String(value ?? '').replace(/"/g, '""');
        return `"${str}"`;
      });
      lines.push(escaped.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey_responses_${from || 'all'}_${to || 'all'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (!isRG) return <div className="card">Super Admin (RG) only.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Super Admin · Survey Responses</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs mb-1">Survey Version</label>
          <select
            className="input"
            value={selectedVersionId ?? ''}
            onChange={(e) => setSelectedVersionId(e.target.value || null)}
          >
            <option value="" disabled>
              Select version
            </option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn btn-secondary" type="button" onClick={handleLoad} disabled={!selectedVersionId}>
          {loading ? 'Loading…' : 'Load'}
        </button>
        <button className="btn btn-primary" type="button" onClick={downloadCSV} disabled={!rows.length}>
          Download CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Respondent</th>
              <th>Question</th>
              <th>Selected providers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.respondent_initials}-${row.response_date}-${idx}`}>
                <td>{row.response_date}</td>
                <td>{row.respondent_initials}</td>
                <td>{questions[row.question_id] ?? row.question_id}</td>
                <td>{(row.selected_initials ?? []).join(', ') || '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="text-sm text-gray-600">
                  No responses for the chosen filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
