'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type RosterRow = { initials:string; full_name:string; active:boolean; is_admin:boolean };

export default function RosterAdmin() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [initials, setInitials] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setMsg(null);
    const { data, error } = await supabaseBrowser
      .from('roster')
      .select('initials, full_name, active, is_admin')
      .order('initials');
    if (error) setMsg(error.message);
    setRows(data ?? []);
    setLoading(false);
  }
  useEffect(()=>{ load(); }, []);

  async function upsert(e:React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const initialsUp = initials.trim().toUpperCase();
    if (!initialsUp || !fullName.trim()) { setMsg('Initials and full name are required.'); return; }
    const { error } = await supabaseBrowser.from('roster').upsert({
      initials: initialsUp, full_name: fullName.trim(), active: true
    });
    if (error) { setMsg(error.message); return; }
    setInitials(''); setFullName(''); load();
  }

  async function toggle(initials:string, field:'active'|'is_admin', value:boolean) {
    const { error } = await supabaseBrowser.from('roster').update({ [field]: value }).eq('initials', initials);
    if (error) { alert(error.message); return; }
    load();
  }

  async function remove(initials:string) {
    if (!confirm(`Remove ${initials} from roster?`)) return;
    const { error } = await supabaseBrowser.from('roster').delete().eq('initials', initials);
    if (error) { alert(error.message); return; }
    load();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Roster</h2>

      <form onSubmit={upsert} className="flex flex-wrap gap-2">
        <input className="input w-24" placeholder="Initials" value={initials} onChange={(e)=>setInitials(e.target.value)} />
        <input className="input flex-1" placeholder="Full name" value={fullName} onChange={(e)=>setFullName(e.target.value)} />
        <button className="btn btn-primary">Add / Update</button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <div className="card">
        {loading ? <p>Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
              <tr><th>Initials</th><th>Name</th><th>Active</th><th>Admin</th><th></th></tr>
              </thead>
              <tbody>
              {rows.map(r => (
                <tr key={r.initials}>
                  <td>{r.initials}</td>
                  <td>{r.full_name}</td>
                  <td><input type="checkbox" checked={r.active} onChange={e=>toggle(r.initials,'active',e.target.checked)} /></td>
                  <td><input type="checkbox" checked={r.is_admin} onChange={e=>toggle(r.initials,'is_admin',e.target.checked)} /></td>
                  <td className="text-right"><button className="btn btn-secondary" onClick={()=>remove(r.initials)}>Remove</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="text-sm text-gray-600">No entries.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
