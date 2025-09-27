// src/app/layout.tsx
import './globals.css';
import React from 'react';

export const metadata = {
  title: 'IMIS',  // Updated title
  description: 'IMIS QI – Quality Improvement Dashboard'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            {/* Site name/branding */}
            <a href="/" className="font-semibold text-gray-900">IMIS</a>
            {/* Navigation links */}
            <nav className="flex gap-4 text-sm">
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
              <a href="/delay" className="text-gray-600 hover:text-gray-900">Delays</a>
              <a href="/rankings" className="text-gray-600 hover:text-gray-900">Rankings</a>
              <a href="/ideas" className="text-gray-600 hover:text-gray-900">Ideas</a>
              <a href="/admin" className="text-gray-600 hover:text-gray-900">Admin</a>
            </nav>
          </div>
        </header>

        {/* Main content */}
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
