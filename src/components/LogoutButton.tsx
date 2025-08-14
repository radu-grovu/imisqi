'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../lib/supabaseBrowser';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.push('/'); // back to login
  }

  return (
    <button onClick={handleLogout} style={{ padding: '6px 10px' }}>
      Logout
    </button>
  );
}
