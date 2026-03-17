/**
 * Matches.jsx, Phase 7.3
 * Page header + filter pills + 2-column card grid.
 */
import { useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMatches } from '../hooks/useMatches';
import AthleteCard from '../components/AthleteCard';
import TryoutModal from '../components/TryoutModal';

const FILTERS = ['All', 'Nearby', 'Same level', 'Lady seeking man'];

export default function Matches() {
  const { athlete, loading: authLoading } = useAuth();
  const { matches, loading, error } = useMatches(athlete?.id);
  const [activeFilter, setActiveFilter] = useState('All');
  const [tryoutMatch, setTryoutMatch]   = useState(null);

  const filtered = useMemo(() => {
    const base = matches.filter(m => m.total_score >= 0.40);
    if (activeFilter === 'All') return base;
    if (activeFilter === 'Nearby') {
      return base.filter(m =>
        athlete?.location_state && m.partner.location_state === athlete.location_state
      );
    }
    if (activeFilter === 'Same level') {
      return base.filter(m => m.partner.skating_level === athlete?.skating_level);
    }
    if (activeFilter === 'Lady seeking man') {
      return base.filter(m => m.partner.partner_role === 'man');
    }
    return base;
  }, [matches, activeFilter, athlete]);

  if (authLoading) return <div className="loading">Loading...</div>;

  if (!athlete) {
    return (
      <main style={{ background: '#f4f7fb', padding: '24px 28px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f2a5e' }}>Your matches</h1>
        <p style={{ color: '#7a8aaa', marginTop: 12 }}>
          You need a profile to see matches.{' '}
          <a href="/profile/new" style={{ color: '#1a56db' }}>Create one</a>
        </p>
      </main>
    );
  }

  const totalVisible = matches.filter(m => m.total_score >= 0.40).length;

  return (
    <main style={{ background: '#f4f7fb', padding: '24px 28px' }}>
      {/* Header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 20,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f2a5e', letterSpacing: '-0.3px' }}>
          Your matches
        </h1>
        <span style={{ fontSize: 12, color: '#7a8aaa' }}>
          {loading ? '...' : `${totalVisible} skaters · pairs + ice dance`}
        </span>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const isActive = activeFilter === f;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                background: isActive ? '#1a56db' : '#fff',
                border: `1px solid ${isActive ? '#1a56db' : '#d4e0f5'}`,
                borderRadius: 20, padding: '5px 13px',
                fontSize: 12, color: isActive ? '#fff' : '#4a5a7a',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card-skeleton" style={{ height: 220 }} />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{
          textAlign: 'center', color: '#7a8aaa', fontSize: 14, marginTop: 60,
        }}>
          No matches yet. Finish your profile to see who&apos;s out there.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14,
        }} className="matches-card-grid">
          {filtered.map((match, i) => (
            <AthleteCard
              key={match.id}
              match={match}
              index={i}
              onRequestTryout={setTryoutMatch}
            />
          ))}
        </div>
      )}

      {tryoutMatch && (
        <TryoutModal
          match={tryoutMatch}
          onClose={() => setTryoutMatch(null)}
          onSuccess={() => setTryoutMatch(null)}
        />
      )}
    </main>
  );
}
