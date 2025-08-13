export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ maxWidth: 780, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Hospitalist Daily Survey</h1>
        {children}
      </body>
    </html>
  );
}
