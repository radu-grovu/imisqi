import './globals.css';
import Header from '@/components/Header';

export const metadata = { title: 'IMIS', description: 'IMIS QI' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        <footer className="mt-12 border-t border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-6 text-xs text-gray-500">© {new Date().getFullYear()} IMIS QI</div>
        </footer>
      </body>
    </html>
  );
}
