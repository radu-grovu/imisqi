'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseBrowser } from '../../../lib/supabaseBrowser';
import SurveyForm from '../../../components/SurveyForm';

export default function SurveyByDatePage() {
  const router = useRouter();
  const params = useParams<{ date: string }>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace('/');
        return;
      }
      setReady(true);
    }
    check();
  }, [router]);

  if (!ready) return <p style={{ padding: 16 }}>Loading…</p>;

  const date = params?.date; // YYYY-MM-DD
  return (
    <main style={{ padding: 16 }}>
      <h1>Survey for {date}</h1>
      <SurveyForm date={date} />
    </main>
  );
}
