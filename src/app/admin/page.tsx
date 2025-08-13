'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function Admin() {
  const [ok, setOk] = useState(false);
  const [name, setName] = useState('Avoidable Days Pilot');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [days, setDays] = useState(14);
  const [tz, setTz] = useState('America/New_York');
  const [hour, setHour] = useState(16);
  const [emails, setEmails] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) { window.location.href = '/'; return; }
      const { data: profile } = await supabaseBrowser.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
      setOk(!!profile?.is_admin);
    })();
  }, []);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    const list = emails.split(/[,\n\s]+/).map(x => x.trim()).filter(Boolean);
    const res = await fetch('/api/admin/create-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startDate, days, tz, hour, emails: list })
    });
    if (!res.ok) { alert('Failed to create campaign'); return; }
    alert('Campaign created. Daily emails will send at the scheduled time.');
  }

  if (!ok) return <p>Admin only.</p>;

  return (
    <div>
      <h2>Create Campaign</h2>
      <form onSubmit={createCampaign} style={{ display:'grid', gap:8 }}>
        <label>Name <input value={name} onChange={e=>setName(e.target.value)} required /></label>
        <label>Start date <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} required /></label>
        <label>Days <input type="number" value={days} onChange={e=>setDays(parseInt(e.target.value||'14'))} min={1} max={31} required /></label>
        <label>Timezone <input value={tz} onChange={e=>setTz(e.target.value)} /></label>
        <label>Daily send hour (0–23) <input type="number" value={hour} onChange={e=>setHour(parseInt(e.target.value||'16'))} min={0} max={23} /></label>
        <label>Provider emails (comma or newline separated)
          <textarea value={emails} onChange={e=>setEmails(e.target.value)} rows={6} placeholder="a@hospital.org, b@hospital.org" />
        </label>
        <button type="submit">Create campaign</button>
      </form>
    </div>
  );
}
