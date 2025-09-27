// src/app/ideas/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabaseBrowser';
import { useRouter } from 'next/navigation';

type Idea = { id: number; content: string; category: string; created_at: string };

export default function IdeasPage() {
  const router = useRouter();
  const [category, setCategory] = useState<'Management' | 'Admitting/ED' | 'Rounding (Day)' | 'Night Shift'>('Management');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdea, setNewIdea] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Ensure logged in, then load ideas for the current category
    (async () => {
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      if (!sessionData.session) {
        router.replace('/');
        return;
      }
      loadIdeas(category);
    })();
  }, [router, category]);

  async function loadIdeas(cat: string) {
    const { data, error } = await supabaseBrowser
      .from('ideas')
      .select('id, content, category, created_at')
      .eq('category', cat)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setIdeas(data);
    }
  }

  async function submitIdea(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const ideaText = newIdea.trim();
    if (ideaText.length === 0) {
      setMsg('Please enter your idea before submitting.');
      return;
    }
    // Insert the new idea into the database
    const { error } = await supabaseBrowser.from('ideas').insert({
      category,
      content: ideaText
      // user_id will be set automatically by Supabase if you use Row Level Security with auth.uid(), 
      // or you can include user_id by fetching it similarly to how we did in other pages.
    });
    if (error) {
      setMsg('Error submitting idea: ' + error.message);
    } else {
      // Clear the input and reload ideas
      setNewIdea('');
      setMsg('✅ Idea submitted!');
      loadIdeas(category);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Ideas for Improvement</h1>
      <p className="text-sm text-gray-700">
        Share your suggestions to improve our workflows. Choose a category and submit your idea.
      </p>

      {/* Category selection tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['Management', 'Admitting/ED', 'Rounding (Day)', 'Night Shift'] as const).map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`btn ${category === cat ? 'btn-primary' : 'btn-secondary'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Ideas List */}
      <div className="card">
        <h2 className="text-lg font-medium mb-2">{category} Ideas</h2>
        {ideas.length > 0 ? (
          <ul className="list-disc list-inside space-y-1">
            {ideas.map(idea => (
              <li key={idea.id} className="text-sm text-gray-800">
                {idea.content}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">No ideas yet in this category. Be the first to contribute!</p>
        )}
      </div>

      {/* Submission Form */}
      <form onSubmit={submitIdea} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder={`Your idea for ${category}...`}
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          className="input flex-1"
        />
        <button type="submit" className="btn btn-primary">
          Submit Idea
        </button>
      </form>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
