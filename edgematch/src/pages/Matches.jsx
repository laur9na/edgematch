/**
 * Matches.jsx, Phase 8.1
 * Left sidebar (220px) with noUiSlider filters + main content area.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMatches } from '../hooks/useMatches';
import AthleteCard from '../components/AthleteCard';

const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juv', juvenile: 'Juvenile',
  novice: 'Novice', junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const LEVEL_KEYS = ['pre_juvenile', 'juvenile', 'novice', 'junior', 'senior', 'adult'];

const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };
const ROLE_LABEL = {
  man: 'Skates as man', lady: 'Skates as lady', either: 'Either role',
};

const LEVEL_ORDER = ['pre_juvenile','juvenile','intermediate','novice','junior','senior','adult'];

const KNOB = {
  width: 16, height: 16, borderRadius: '50%', background: '#fff',
  boxShadow: '0 1px 4px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.08)',
  position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)',
  pointerEvents: 'none', zIndex: 2,
};

// No dual-input approach — two overlapping inputs can't be independently clicked.
// Replaced with two labeled single sliders (min/max) that always work.

// Single-handle range slider
function SingleRangeSlider({ min, max, step, value, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ position: 'relative', height: 20, margin: '8px 4px 4px' }}>
      <div style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        left: 0, right: 0, height: 3, background: '#e2e8f0', borderRadius: 99,
      }}>
        <div style={{
          position: 'absolute', height: '100%', background: '#1a56db', borderRadius: 99,
          left: 0, right: `${100 - pct}%`,
        }} />
      </div>
      <div style={{ ...KNOB, left: `${pct}%` }} />
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', height: 20, margin: 0 }}
      />
    </div>
  );
}

function Sidebar({ strength, onStrength, distance, onDistance, levels, onLevels, disciplines, onDisciplines, roles, onRoles }) {
  function toggleLevel(key) {
    onLevels(prev => prev.includes(key) ? prev.filter(l => l !== key) : [...prev, key]);
  }
  function toggleDiscipline(val) {
    onDisciplines(prev => prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]);
  }
  function toggleRole(val) {
    onRoles(prev => prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]);
  }

  const divider = (
    <hr style={{ border: 'none', borderTop: '1px solid #f0f4fb', margin: '16px 0' }} />
  );

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: '#fff', borderRight: '1px solid #d4e0f5',
      padding: '20px 16px', alignSelf: 'flex-start',
      position: 'sticky', top: 56,
      minHeight: 'calc(100vh - 56px)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2a5e', marginBottom: 16 }}>
        Filter matches
      </div>

      {/* Match strength: two independent sliders */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5a7a', marginBottom: 6 }}>
        Match strength
      </div>
      <div style={{ fontSize: 11, color: '#7a8aaa', marginBottom: 2 }}>Min: <span style={{ color: '#1a56db', fontWeight: 600 }}>{strength[0]}%</span></div>
      <SingleRangeSlider min={0} max={100} step={1} value={strength[0]}
        onChange={v => onStrength([Math.min(v, strength[1]), strength[1]])} />
      <div style={{ fontSize: 11, color: '#7a8aaa', marginBottom: 2, marginTop: 6 }}>Max: <span style={{ color: '#1a56db', fontWeight: 600 }}>{strength[1]}%</span></div>
      <SingleRangeSlider min={0} max={100} step={1} value={strength[1]}
        onChange={v => onStrength([strength[0], Math.max(v, strength[0])])} />

      {divider}

      {/* Distance */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5a7a', marginBottom: 4 }}>
        Distance
      </div>
      <div style={{ fontSize: 12, color: '#1a56db', marginBottom: 2 }}>
        Within {distance === 5000 ? '5000+' : distance} km
      </div>
      <SingleRangeSlider min={0} max={5000} step={50} value={distance} onChange={onDistance} />

      {divider}

      {/* Level pills */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5a7a', marginBottom: 8 }}>
        Level
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LEVEL_KEYS.map(key => {
          const active = levels.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggleLevel(key)}
              style={{
                padding: '4px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                background: active ? '#eef3fe' : '#fff',
                border: `1px solid ${active ? '#1a56db' : '#d4e0f5'}`,
                color: active ? '#1a56db' : '#4a5a7a',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.12s',
              }}
            >
              {LEVEL_LABEL[key]}
            </button>
          );
        })}
      </div>

      {divider}

      {/* Discipline */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5a7a', marginBottom: 6 }}>Discipline</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {['ice_dance', 'pairs'].map(val => (
          <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#4a5a7a', cursor: 'pointer' }}>
            <input type="checkbox" style={{ margin: 0, flexShrink: 0, accentColor: '#1a56db' }} checked={disciplines.includes(val)} onChange={() => toggleDiscipline(val)} />
            <span>{DISCIPLINE_LABEL[val]}</span>
          </label>
        ))}
      </div>

      {divider}

      {/* Role */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5a7a', marginBottom: 6 }}>Role</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {['man', 'lady', 'either'].map(val => (
          <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#4a5a7a', cursor: 'pointer' }}>
            <input type="checkbox" style={{ margin: 0, flexShrink: 0, accentColor: '#1a56db' }} checked={roles.includes(val)} onChange={() => toggleRole(val)} />
            <span>{ROLE_LABEL[val]}</span>
          </label>
        ))}
      </div>
    </aside>
  );
}

export default function Matches() {
  const navigate = useNavigate();
  const { athlete, loading: authLoading } = useAuth();
  const { matches, loading, error } = useMatches(athlete?.id);

  // Restore filter state from sessionStorage so it survives navigate(-1)
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem('matchFilters') || 'null'); } catch { return null; } })();
  const [strength, setStrength]       = useState(saved?.strength       ?? [40, 100]);
  const [distance, setDistance]       = useState(saved?.distance       ?? 500);
  const [levels, setLevels]           = useState(saved?.levels         ?? []);
  const [disciplines, setDisciplines] = useState(saved?.disciplines    ?? ['pairs', 'ice_dance']);
  const [roles, setRoles]             = useState(saved?.roles          ?? ['man', 'lady', 'either']);

  useEffect(() => {
    sessionStorage.setItem('matchFilters', JSON.stringify({ strength, distance, levels, disciplines, roles }));
  }, [strength, distance, levels, disciplines, roles]);

  const filtered = useMemo(() => {
    let list = matches.filter(m => {
      const pct = Math.round(m.total_score * 100);
      if (pct < strength[0] || pct > strength[1]) return false;

      // Distance proxy: use location_score (0=far, 1=same city)
      // distance 500km ~ location_score 0.3, 100km ~ 0.7, 5000km ~ 0
      if (distance < 5000) {
        const minLocScore = Math.max(0, 1 - distance / 2000);
        if ((m.location_score ?? 0) < minLocScore) return false;
      }

      if (levels.length > 0 && !levels.includes(m.partner?.skating_level)) return false;
      if (disciplines.length > 0 && !disciplines.includes(m.partner?.discipline)) return false;
      if (roles.length > 0 && !roles.includes(m.partner?.partner_role)) return false;

      return true;
    });

    list = [...list].sort((a, b) => b.total_score - a.total_score);

    return list;
  }, [matches, strength, distance, levels, disciplines, roles]);

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

  return (
    <div style={{ display: 'flex', background: '#f4f7fb', minHeight: 'calc(100vh - 56px)', alignItems: 'flex-start' }}>
      <Sidebar
        strength={strength} onStrength={setStrength}
        distance={distance} onDistance={setDistance}
        levels={levels} onLevels={setLevels}
        disciplines={disciplines} onDisciplines={setDisciplines}
        roles={roles} onRoles={setRoles}
      />

      <main style={{ flex: 1, padding: '24px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f2a5e', letterSpacing: '-0.3px', marginBottom: 18 }}>
          Your matches
        </h1>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card-skeleton" style={{ height: 200 }} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7a8aaa', fontSize: 14, marginTop: 60 }}>
            No matches found. Try adjusting the filters.
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            {filtered.map((match, i) => (
              <AthleteCard
                key={match.id}
                match={match}
                index={i}
                onClick={() => navigate(`/matches/${match.partner.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
