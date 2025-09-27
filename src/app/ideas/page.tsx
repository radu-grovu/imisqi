'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { useRouter } from 'next/navigation';

type Idea = { id:number; category:string; content:string; created_at:string; kept:boolean };

const CATS = ['Management','Admitting/ED','Rounding (Day)','Night Shift'] as const;
type Cat = typeof CATS[number];

export default function IdeasPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string|null>(null);
  const [cat, setCat] = useState<Cat>('Management');
  const [newContent, setNewContent] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace('/auth/login'); return; }
      setUserId(data.session.user.id);
      await load(data.session.user.id, cat);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(uid:string, category:Cat) {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('ideas')
      .select('id, category, content, created_at, kept')
      .eq('user_id', uid)
      .eq('category', category)
      .order('created_at', { ascending: false });
    if (error) setMsg(error.message);
    setIdeas((data ?? []) as Idea[]);
    setLoading(false);
  }

  async function submitIdea(e:React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const content = newContent.trim();
    if (!content) return;
    const { data, error } = await supabaseBrowser
      .from('ideas')
      .insert({ category: cat, content })
      .select('id, category, content, created_at, kept')
      .single();
    if (error) { setMsg(error.message); return; }
    setIdeas(prev => [data as Idea, ...prev]);
    setNewContent('');
  }

  function setField(id:number, field:keyof Idea, value:any) {
    setIdeas(prev => prev.map(r => r.id===id ? { ...r, [field]: value } : r));
  }

  async function saveIdea(i: Idea) {
    const { error } = await supabaseBrowser
      .from('ideas')
      .update({ content: i.content })
      .eq('id', i.id);
    if (error) { setMsg(error.message); return; }
    setMsg('Saved.');
    setTimeout(()=>setMsg(null), 1200);
  }

  async function deleteIdea(id:number) {
    if (!confirm('Delete this idea?')) return;
    const { error } = await supabaseBrowser.from('ideas').delete().eq('id', id);
    if (error) { setMsg(error.message); return; }
    setIdeas(prev => prev.filter(x => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ideas</h1>

      <div className="card flex flex-wrap gap-2">
        {CATS.map(c => (
          <button key={c}
            className={`btn ${cat===c?'btn-primary':'btn-secondary'}`}
            onClick={async ()=>{ setCat(c); if (userId) await load(userId, c); }}>
            {c}
          </button>
        ))}
      </div>

      <form onSubmit={submitIdea} className="card space-y-3">
        <h2 className="text-lg font-medium">Submit a new {cat} idea</h2>
        <textarea className="input w-full" placeholder="Type your idea…"
          value={newContent} onChange={(e)=>setNewContent(e.target.value)} />
        <div className="text-right">
          <button className="btn btn-primary">Submit</button>
        </div>
      </form>

      <div className="card">
        <h2 className="text-lg font-medium mb-2">Your {cat} ideas</h2>
        {loading ? <p>Loading…</p> : ideas.length ? (
          <ul className="space-y-4">
            {ideas.map(i => (
              <li key={i.id} className="border rounded-lg p-3 space-y-2">
                <div className="text-xs text-gray-500">{new Date(i.created_at).toLocaleString()}{i.kept && <span className="ml-2 inline-block text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">Kept</span>}</div>
                <div className="flex items-start gap-2">
                  <span className="i i-pencil mt-2" title="Edit" />
                  <textarea className="input w-full" value={i.content}
                    onChange={(e)=>setField(i.id,'content', e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <button className="btn btn-secondary" onClick={()=>saveIdea(i)}>Save</button>
                  <button className="btn btn-danger" onClick={()=>deleteIdea(i.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-600">No ideas yet in this category.</p>}
      </div>

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
