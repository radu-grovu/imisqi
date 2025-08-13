'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../../lib/supabaseBrowser';
import SurveyForm from '../../../components/SurveyForm';

export default function SurveyPage({ params, searchParams }: any) {
  const date = params.date; // YYYY-MM-DD
  const campaignId = String(searchParams.campaign || '');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/'; else setUser(data.user);
    });
  }, []);

  if (!campaignId) return <p>Missing campaign.</p>;
  if (!user) return <p>Loading…</p>;
  return (
    <div>
      <h2>Survey for {date}</h2>
      <SurveyForm campaignId={campaignId} date={date} />
    </div>
  );
}
