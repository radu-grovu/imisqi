'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace('/auth/login');
        return;
      }
      setReady(true);
    })();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOk(null);

    // Basic checks
    if (!newPw || !confirmPw) {
      setMsg('Enter and confirm your new password.');
      return;
    }
    if (newPw !== confirmPw) {
      setMsg('Passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      setMsg('Use at least 8 characters.');
      return;
    }

    setBusy(true);
    const { error } = await supabaseBrowser.auth.updateUser({ password: newPw });
    setBusy(false);

    if (error) {
      setMsg(error.message || 'Failed to update password.');
      return;
    }

    setOk('Password updated. You can use your new password the next time you sign in.');
    setNewPw('');
    setConfirmPw('');
  }

  if (!ready) return null;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Change Password</h1>
      <p className="text-sm text-gray-600">
        Set a new password for your account. You will remain signed in after changing it.
      </p>

      <form onSubmit={submit} className="card space-y-3">
        <div>
          <label className="block text-xs mb-1">New password</label>
          <input
            type="password"
            className="input w-full"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Confirm password</label>
          <input
            type="password"
            className="input w-full"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save Password'}
          </button>
        </div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        {ok && <p className="text-sm text-green-700">{ok}</p>}
      </form>
    </div>
  );
}
