// server-only helper to enforce the gate cookie
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export function requireGate() {
  const ok = cookies().get('gate_ok')?.value === '1';
  if (!ok) redirect('/gate');
}
