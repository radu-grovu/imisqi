export const metadata = { title: 'Hospitalist Daily Survey' };

import './globals.css'; // if you don't have this file, you can remove this line
import Link from 'next/link';
import LogoutButton from '../components/LogoutButton';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{
          display: 'flex', gap: 12, alignItems: 'center',
          padding: '10px 16px', borderBottom: '1px solid #eee'
        }}>
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <div style={{ marginLeft: 'auto' }}>
            <LogoutButton />
          </div>
        </header>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
