'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type RosterRow = {
  initials: string;
  full_name: string;
  active: boolean;
  is_admin: boolean;
};

export default function RosterAdmin() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [initials, setInitials] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('roster')
      .select('initials, full_name, active, is_admin')
      .order('initials');
    if (error) setMsg(error.message);
    setRows((data ?? []) as RosterRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function upsert(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const initialsUp = initials.trim().toUpperCase();
    const nameTrimmed = fullName.trim();
    if (!initialsUp || !nameTrimmed) {
      setMsg('Initials and full name are required.');
      return;
    }

    // Preserve existing active/admin flags when updating an existing entry
    let activeStatus = true;
    let adminStatus = false;
    const { data: existing, error: fetchErr } = await supabaseBrowser
      .from('roster')
      .select('active, is_admin')
      .eq('initials', initialsUp)
      .maybeSingle();

    if (fetchErr) {
      setMsg(fetchErr.message);
      return;
    }
    if (existing) {
      activeStatus = existing.active;
      adminStatus = existing.is_admin;
    }

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

    setInitials('');
    setFullName('');
    await load();
  }

  async function toggle(initials: string, field: 'active' | 'is_admin', value: boolean) {
    setMsg(null);
    const { error } = await supabaseBrowser
      .from('roster')
      .update({ [field]: value })
      .eq('initials', initials);

    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
  }

  async function remove(initialsToRemove: string) {
    if (!confirm(`Remove ${initialsToRemove} from roster? This will permanently delete all their data.`)) return;
    setMsg(null);

    // Use server-side RPC to delete all related data and the roster row atomically
    const { error } = await supabaseBrowser.rpc('admin_delete_roster_and_data', {
      p_initials: initialsToRemove,
    });

    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
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
        {loading ? (
          <p>Loading…</p>
        ) : (
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
                {rows.map((r) => (
                  <tr key={r.initials}>
                    <td>{r.initials}</td>
                    <td>{r.full_name}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={(e) => toggle(r.initials, 'active', e.target.checked)}
                        aria-label={`Toggle active for ${r.initials}`}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.is_admin}
                        onChange={(e) => toggle(r.initials, 'is_admin', e.target.checked)}
                        aria-label={`Toggle admin for ${r.initials}`}
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
                    <td colSpan={5} className="text-sm text-gray-600">
                      No entries.
                    </td>
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
