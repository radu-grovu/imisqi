// src/app/layout.tsx
import './globals.css';
import React from 'react';

// Optional: keep or adapt this metadata block
export const metadata = {
  title: 'Hospitalist Daily Survey',
  description: 'IMIS QI – Length of Stay Delay Tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="font-semibold text-gray-900">Hospitalist Daily Survey</a>
            <nav className="flex gap-4 text-sm">
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
              <a href="/admin" className="text-gray-600 hover:text-gray-900">Admin</a>
            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-12 border-t border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-6 text-xs text-gray-500">
            © {new Date().getFullYear()} IMIS QI
          </div>
        </footer>
      </body>
    </html>
  );
}
