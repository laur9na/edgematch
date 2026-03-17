/**
 * Matches.jsx — Phase 2.2 + 2.3
 * Ranked match list with client-side filter sidebar.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMatches } from '../hooks/useMatches';
import AthleteCard from '../components/AthleteCard';

const LEVELS = ['pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult'];
const LEVEL_LABELS = {
  pre_juvenile: 'Pre-Juv', juvenile: 'Juvenile', intermediate: 'Intermediate',
  novice: 'Novice', junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const ROLE_LABELS = { lady: 'Lady', man: 'Man', either: 'Either' };

const DEFAULT_FILTERS = {
  minScore: 0.3,
  levelMin: '',
  levelMax: '',
  role: '',
  country: '',
};

export default function Matches() {
  const { athlete, loading: authLoading } = useAuth();
  const { matches, loading, error } = useMatches(athlete?.id);
  const navigate = useNavigate();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function setFilter(key, value) {
    setFilters(f => ({ ...f, [key]: value }));
  }

  // Client-side filtering — no extra queries
  const filtered = useMemo(() => {
    return matches.filter(m => {
      const p = m.partner;
      if (m.total_score < filters.minScore) return false;
      if (filters.role && p.partner_role !== filters.role) return false;
      if (filters.country && p.location_country !== filters.country) return false;
      if (filters.levelMin) {
        if (LEVELS.indexOf(p.skating_level) < LEVELS.indexOf(filters.levelMin)) return false;
      }
      if (filters.levelMax) {
        if (LEVELS.indexOf(p.skating_level) > LEVELS.indexOf(filters.levelMax)) return false;
      }
      return true;
    });
  }, [matches, filters]);

  // Unique countries in result set for the country filter
  const countries = useMemo(() => {
    const s = new Set(matches.map(m => m.partner.location_country).filter(Boolean));
    return [...s].sort();
  }, [matches]);

  function handleRequestTryout(match) {
    // Phase 3 will open TryoutModal — navigate to tryouts for now
    navigate('/tryouts');
  }

  // --- render states ---
  if (authLoading) return <div className="loading">Loading…</div>;

  if (!athlete) {
    return (
      <main className="page-content">
        <h1>Your Matches</h1>
        <p>You need a profile to see matches. <a href="/profile/new">Create one →</a></p>
      </main>
    );
  }

  return (
    <div className="matches-layout">
      {/* Filter sidebar */}
      <aside className={`matches-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <span>Filters</span>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        {sidebarOpen && (
          <div className="sidebar-body">
            <label>Min score
              <div className="filter-score-row">
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={filters.minScore}
                  onChange={e => setFilter('minScore', parseFloat(e.target.value))}
                />
                <span>{Math.round(filters.minScore * 100)}%</span>
              </div>
            </label>

            <label>Level — from
              <select value={filters.levelMin} onChange={e => setFilter('levelMin', e.target.value)}>
                <option value="">Any</option>
                {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
              </select>
            </label>

            <label>Level — to
              <select value={filters.levelMax} onChange={e => setFilter('levelMax', e.target.value)}>
                <option value="">Any</option>
                {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
              </select>
            </label>

            <label>Role
              <select value={filters.role} onChange={e => setFilter('role', e.target.value)}>
                <option value="">Any</option>
                {Object.entries(ROLE_LABELS).map(([v, l]) =>
                  <option key={v} value={v}>{l}</option>
                )}
              </select>
            </label>

            <label>Country
              <select value={filters.country} onChange={e => setFilter('country', e.target.value)}>
                <option value="">Any</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <button
              className="btn-reset-filters"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              Reset filters
            </button>
          </div>
        )}
      </aside>

      {/* Main results */}
      <main className="matches-main">
        <div className="matches-header">
          <h1>Your Matches</h1>
          <span className="matches-count">
            {loading ? '…' : `${filtered.length} of ${matches.length}`}
          </span>
        </div>

        <p className="matches-subtitle">
          {athlete.discipline === 'ice_dance' ? 'Ice Dance' : 'Pairs'} ·
          Ranked by compatibility score
        </p>

        {error && <p className="form-error">{error}</p>}

        {loading && (
          <div className="card-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="card-skeleton" />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <p>No matches found with the current filters.</p>
            <button onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="card-grid">
            {filtered.map(match => (
              <AthleteCard
                key={match.id}
                match={match}
                onRequestTryout={handleRequestTryout}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
