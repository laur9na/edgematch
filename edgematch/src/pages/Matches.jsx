// Matches.jsx — placeholder for Phase 2
import { useAuth } from '../hooks/useAuth';

export default function Matches() {
  const { athlete } = useAuth();
  return (
    <main className="page-content">
      <h1>Your Matches</h1>
      {athlete ? (
        <p>Match results coming in Phase 2. Your profile is saved, {athlete.name}!</p>
      ) : (
        <p>Loading…</p>
      )}
    </main>
  );
}
