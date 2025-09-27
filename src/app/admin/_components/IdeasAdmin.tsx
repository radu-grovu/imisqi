'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Idea = { id:number; category:string; content:string; created_at:string; kept:boolean };
type Trash = { id:number; category:string; content:string; created_at:string; trashed_at:string };

const CATS = ['Management','Admitting/ED','Rounding (Day)','Night Shift'] as const;
type Cat = typeof CATS[number];

export default function IdeasAdmin() {
  const [tab, setTab] = useState<'active'|'trash'>('active');
  const [cat, setCat] = useState<Cat>('Management');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [trash, setTrash] = useState<Trash[]>([]);
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  async function loadActive() {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('ideas')
      .select('id, category, content, created_at, kept')
      .eq('category', cat)
      .order('created_at', { ascending: false });
    if (error) setMsg(error.message);
    setIdeas(data ?? []);
    setLoading(false);
  }

  async function loadTrash() {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('ideas_trash')
      .select('id, category, content, created_at, trashed_at')
      .order('trashed_at', { ascending: false });
    if (error) setMsg(error.message);
    setTrash(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    tab === 'active' ? loadActive() : loadTrash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cat]);

  async function keep(id:number) {
    setMsg(null);
    const { error } = await supabaseBrowser
      .from('ideas')
      .update({ kept: true })
      .eq('id', id);
    if (error) { setMsg(error.message); return; }
    setIdeas(prev => prev.map(i => i.id===id ? { ...i, kept:true } : i));
  }

  async function trashIdea(id:number) {
    setMsg(null);
    // fetch full idea so we can insert into trash
    const { data: idea, error: fErr } = await supabaseBrowser.from('ideas').select('*').eq('id', id).single();
    if (fErr || !idea) { setMsg('Unable to find idea to trash'); return; }
    const ins = await supabaseBrowser.from('ideas_trash').insert({
      user_id: idea.user_id ?? null,
      category: idea.category,
      content: idea.content,
      created_at: idea.created_at
    });
    if (ins.error) { setMsg(ins.error.message); return; }
    const del = await supabaseBrowser.from('ideas').delete().eq('id', id);
    if (del.error) { setMsg(del.error.message); return; }
    setIdeas(prev => prev.filter(i => i.id !== id));
  }

  async function emptyTrash() {
    if (!confirm('Permanently delete all trashed ideas?')) return;
    const { error } = await supabaseBrowser.from('ideas_trash').delete().neq('id', -1);
    if (error) { setMsg(error.message); return; }
    setTrash([]);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Ideas for Improvement</h2>

      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setTab('active')} className={`btn ${tab==='active'?'btn-primary':'btn-secondary'}`}>Active</button>
        <button onClick={()=>setTab('trash')} className={`btn ${tab==='trash'?'btn-primary':'btn-secondary'}`}>Trashed Ideas</button>
        {tab === 'active' && (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600">Category:</span>
            {CATS.map(c => (
              <button key={c} onClick={()=>setCat(c)} className={`btn ${cat===c?'btn-secondary':'btn-ghost'}`}>{c}</button>
            ))}
          </div>
        )}
        {tab === 'trash' && (
          <button className="btn btn-danger" onClick={emptyTrash}>Empty Trash</button>
        )}
      </div>

      {tab === 'active' && (
        <div className="card">
          <h3 className="text-lg font-medium mb-2">{cat}</h3>
          {loading ? <p>Loading…</p> : ideas.length ? (
            <ul className="space-y-3">
              {ideas.map(i => (
                <li key={i.id} className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm">{i.content}</div>
                    <div className="text-xs text-gray-500">{new Date(i.created_at).toLocaleString()}</div>
                    {i.kept && <span className="inline-block text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded mt-1">Kept</span>}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={()=>keep(i.id)} disabled={i.kept}>Keep</button>
                    <button className="btn btn-danger" onClick={()=>trashIdea(i.id)}>Trash</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-600">No ideas.</p>}
        </div>
      )}

      {tab === 'trash' && (
        <div className="card">
          <h3 className="text-lg font-medium mb-2">Trashed Ideas</h3>
          {loading ? <p>Loading…</p> : trash.length ? (
            <ul className="space-y-3">
              {trash.map(t => (
                <li key={t.id} className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm">{t.content}</div>
                    <div className="text-xs text-gray-500">
                      Created: {new Date(t.created_at).toLocaleString()} · Trashed: {new Date(t.trashed_at).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-600">Trash is empty.</p>}
        </div>
      )}

      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </section>
  );
}
