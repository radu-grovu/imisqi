'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function Header() {
  const pathname = usePathname();
  const onGate = pathname?.startsWith('/gate');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      if (!sessionData.session) return;
      const userId = sessionData.session.user.id;
      // Fetch the user's profile (including initials and admin flag)
      const { data: prof } = await supabaseBrowser
        .from('profiles')
        .select('initials, is_admin')
        .eq('id', userId)
        .single();
      let adminAccess = false;
      if (prof) {
        // Grant access if profile says admin or if user is RG
        if (prof.is_admin) adminAccess = true;
        if ((prof.initials ?? '').toUpperCase() === 'RG') adminAccess = true;
        // If not already admin via profile or RG, check roster marking
        if (!adminAccess) {
          const { data: rosterEntry } = await supabaseBrowser
            .from('roster')
            .select('is_admin')
            .eq('initials', prof.initials)
            .single();
          if (rosterEntry?.is_admin) adminAccess = true;
        }
      }
      setIsAdmin(adminAccess);
    })();
  }, []);

  return (
    <header className="bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-gray-900">IMIS</Link>
        {!onGate && (
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link href="/delay" className="text-gray-600 hover:text-gray-900">Delays</Link>
            <Link href="/rankings" className="text-gray-600 hover:text-gray-900">Rankings</Link>
            <Link href="/ideas" className="text-gray-600 hover:text-gray-900">Ideas</Link>
            {isAdmin && (
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                Admin
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
