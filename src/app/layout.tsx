import Link from 'next/link';
import LogoutButton from '../components/LogoutButton';

export const metadata = { title: 'Hospitalist Daily Survey' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '10px 16px',
            borderBottom: '1px solid #eee',
          }}
        >
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <div style={{ marginLeft: 'auto' }}>
            <LogoutButton />
          </div>
        </header>

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '12px 16px' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
