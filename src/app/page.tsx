'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function Home() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`;
    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) alert(error.message); else setSent(true);
  }

  if (session) {
    return (
      <div>
        <p>You are signed in.</p>
        <p><a href="/dashboard">Go to Dashboard →</a></p>
      </div>
    );
  }

  return (
    <div>
      <p>Sign in with your work email. You’ll get a one‑time magic link.</p>
      <form onSubmit={sendMagicLink} style={{ display: 'flex', gap: 8 }}>
        <input required type="email" placeholder="you@hospital.org" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <button type="submit">Send Link</button>
      </form>
      {sent && <p>Check your inbox for the sign‑in link.</p>}
    </div>
  );
}
