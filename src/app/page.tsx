// SERVER component
import { requireGate } from '../utils/requireGate';
import LandingSignIn from '../components/LandingSignIn'; // your existing sign-in UI moved to a client component

export default function HomePage() {
  requireGate();           // ⬅ gate check happens before render
  return <LandingSignIn />; // if gate ok, render the sign-in UI
}
