'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type RosterRow = { initials: string; full_name: string; active: boolean; is_admin: boolean };

export default function RosterAdmin() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [initials, setInitials] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('roster')
      .select('initials, full_name, active, is_admin')
      .order('initials');
    if (error) setMsg(error.message);
    setRows(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function upsert(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const initialsUp = initials.trim().toUpperCase();
    const nameTrimmed = fullName.trim();
    if (!initialsUp || !nameTrimmed) {
      setMsg('Initials and full name are required.');
      return;
    }
    // Preserve existing active/admin status if this initials already exists
    let activeStatus = true;
    let adminStatus = false;
    const { data: existing, error: fetchErr } = await supabaseBrowser
      .from('roster')
      .select('active, is_admin')
      .eq('initials', initialsUp)
      .single();
    if (fetchErr) {
      // If an error occurs fetching (or no entry), we default to active true, is_admin false for new user
      if (fetchErr.code !== 'PGRST116') { // PGRST116 = No rows found (not an actual error for our logic)
        setMsg(fetchErr.message);
        return;
      }
    }
    if (existing) {
      activeStatus = existing.active;
      adminStatus = existing.is_admin;
    }
    // Perform upsert with preserved status
    const { error: upsertErr } = await supabaseBrowser.from('roster').upsert({
      initials: initialsUp,
      full_name: nameTrimmed,
      active: activeStatus,
      is_admin: adminStatus,
    });
    if (upsertErr) {
      setMsg(upsertErr.message);
      return;
    }
    // Clear form and reload list
    setInitials('');
    setFullName('');
    load();
  }

  async function toggle(initials: string, field: 'active' | 'is_admin', value: boolean) {
    const { error } = await supabaseBrowser.from('roster')
      .update({ [field]: value })
      .eq('initials', initials);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  async function remove(initials: string) {
    if (!confirm(`Remove ${initials} from roster? This will permanently delete all their data.`)) {
      return;
    }
    setMsg(null);
    // Look up the user's profile ID (if they have one) to remove related records
    const { data: profile, error: profErr } = await supabaseBrowser
      .from('profiles')
      .select('id')
      .eq('initials', initials)
      .single();
    if (profErr && profErr.code !== 'PGRST116') {
      // If an actual error occurs (other than "no rows found"), abort
      alert(profErr.message);
      return;
    }
    const userId = profile?.id;
    // Delete related data in other tables if profile/user exists
    if (userId) {
      const { error: ideasErr } = await supabaseBrowser.from('ideas').delete().eq('user_id', userId);
      if (ideasErr) { alert(ideasErr.message); return; }
      const { error: ideasTrashErr } = await supabaseBrowser.from('ideas_trash').delete().eq('user_id', userId);
      if (ideasTrashErr) { alert(ideasTrashErr.message); return; }
      const { error: reviewsErr } = await supabaseBrowser
        .from('rank_reviews')
        .delete()
        .or(`reviewer_initials.eq.${initials},reviewee_initials.eq.${initials}`);
      if (reviewsErr) { alert(reviewsErr.message); return; }
      const { error: surveysErr } = await supabaseBrowser.from('discharge_surveys').delete().eq('user_id', userId);
      if (surveysErr) { alert(surveysErr.message); return; }
      const { error: noDelaysErr } = await supabaseBrowser.from('discharge_no_delays').delete().eq('user_id', userId);
      if (noDelaysErr) { alert(noDelaysErr.message); return; }
      const { error: profileDelErr } = await supabaseBrowser.from('profiles').delete().eq('id', userId);
      if (profileDelErr) { alert(profileDelErr.message); return; }
    }
    // Finally, remove from roster
    const { error: rosterErr } = await supabaseBrowser.from('roster').delete().eq('initials', initials);
    if (rosterErr) {
      alert(rosterErr.message);
      return;
    }
    load();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Roster</h2>

      <form onSubmit={upsert} className="flex flex-wrap gap-2">
        <input 
          className="input w-24" 
          placeholder="Initials" 
          value={initials} 
          onChange={(e) => setInitials(e.target.value)} 
        />
        <input 
          className="input flex-1" 
          placeholder="Full name" 
          value={fullName} 
          onChange={(e) => setFullName(e.target.value)} 
        />
        <button className="btn btn-primary">Add / Update</button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <div className="card">
        {loading ? <p>Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Initials</th>
                  <th>Name</th>
                  <th>Active</th>
                  <th>Admin</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.initials}>
                    <td>{r.initials}</td>
                    <td>{r.full_name}</td>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={r.active} 
                        onChange={e => toggle(r.initials, 'active', e.target.checked)} 
                      />
                    </td>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={r.is_admin} 
                        onChange={e => toggle(r.initials, 'is_admin', e.target.checked)} 
                      />
                    </td>
                    <td className="text-right">
                      <button className="btn btn-secondary" onClick={() => remove(r.initials)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="text-sm text-gray-600">No entries.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
