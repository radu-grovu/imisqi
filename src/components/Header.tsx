'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [initials, setInitials] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Hide nav on gate/auth routes if you use those
  const hideNav =
    pathname?.startsWith('/gate') ||
    pathname?.startsWith('/auth');

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      const session = data.session;
      if (!session) {
        setIsLoggedIn(false);
        setIsAdmin(false);
        setInitials('');
        return;
      }
      setIsLoggedIn(true);

      // Get profile (initials, is_admin)
      const { data: prof } = await supabaseBrowser
        .from('profiles')
        .select('initials, is_admin')
        .eq('id', session.user.id)
        .single();

      const userInitials =
        prof?.initials ??
        (session.user.email ? session.user.email.split('@')[0] : '');

      setInitials(userInitials?.toUpperCase() ?? '');

      // Admin rule: profile.is_admin OR roster.is_admin OR initials === 'RG'
      let adminAccess = !!prof?.is_admin || userInitials?.toUpperCase() === 'RG';
      if (!adminAccess && userInitials) {
        const { data: rosterRec } = await supabaseBrowser
          .from('roster')
          .select('is_admin')
          .eq('initials', userInitials.toUpperCase())
          .maybeSingle();
        if (rosterRec?.is_admin) adminAccess = true;
      }
      setIsAdmin(adminAccess);
    })();
  }, []);

  async function signOut() {
    await supabaseBrowser.auth.signOut();
    router.replace('/');
  }

  return (
    <header className="bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: brand + initials badge (if logged in) */}
        <div className="flex items-center gap-2">
          <Link href="/" className="font-semibold text-gray-900">
            IMIS
          </Link>
          {isLoggedIn && initials && (
            <span
              className="text-xs px-2 py-0.5 rounded border border-gray-300 bg-gray-50 text-gray-800"
              title="You are logged in as"
            >
              {initials}
            </span>
          )}
        </div>

        {/* Right: nav */}
        {!hideNav && (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/delay" className="text-gray-600 hover:text-gray-900">
              Delays
            </Link>
            <Link href="/rankings" className="text-gray-600 hover:text-gray-900">
              Hospitalist Rankings <span className="ml-1 align-middle inline-block text-[10px] px-1 py-[1px] rounded bg-yellow-200 text-yellow-800 font-semibold">BETA</span>
            </Link>
            <Link href="/ideas" className="text-gray-600 hover:text-gray-900">
              Ideas
            </Link>
            {isLoggedIn && (
              <Link href="/account/password" className="text-gray-600 hover:text-gray-900">
                Change Password
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                Admin
              </Link>
            )}
            {isLoggedIn && (
              <button onClick={signOut} className="text-gray-600 hover:text-gray-900">
                Sign out
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
