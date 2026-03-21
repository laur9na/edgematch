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
  width: 14, height: 14, borderRadius: '50%', background: '#fff',
  boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
  position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)',
  pointerEvents: 'none', zIndex: 2,
};

// Single-handle range slider (used for distance)
function SingleRangeSlider({ min, max, step, value, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ position: 'relative', height: 20, margin: '4px 0' }}>
      <div style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        left: 0, right: 0, height: 3, background: '#e2e8f0', borderRadius: 99,
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', height: '100%', background: '#c9a96e', borderRadius: 99,
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

// Dual-handle range slider: two overlapping inputs sharing one visual track
function DualRangeSlider({ min, max, step, values, onChange }) {
  const [lo, hi] = values;
  const pctLo = ((lo - min) / (max - min)) * 100;
  const pctHi = ((hi - min) / (max - min)) * 100;
  // When lo is in the upper half, bring lo input on top so it can be dragged left
  const loZ = pctLo > 50 ? 5 : 3;
  const hiZ = pctLo > 50 ? 3 : 5;
  return (
    <div style={{ position: 'relative', height: 20, margin: '4px 0' }}>
      <div style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        left: 0, right: 0, height: 3, background: '#e2e8f0', borderRadius: 99,
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', height: '100%', background: '#c9a96e', borderRadius: 99,
          left: `${pctLo}%`, right: `${100 - pctHi}%`,
        }} />
      </div>
      <div style={{ ...KNOB, left: `${pctLo}%` }} />
      <div style={{ ...KNOB, left: `${pctHi}%` }} />
      <input type="range" min={min} max={max} step={step} value={lo}
        onChange={e => onChange([Math.min(+e.target.value, hi), hi])}
        style={{ position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', height: 20, margin: 0, zIndex: loZ }}
      />
      <input type="range" min={min} max={max} step={step} value={hi}
        onChange={e => onChange([lo, Math.max(+e.target.value, lo)])}
        style={{ position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', height: 20, margin: 0, zIndex: hiZ }}
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

  const SECTION_LABEL = {
    fontSize: 10, fontWeight: 600, color: '#c9a96e',
    letterSpacing: '0.14em', textTransform: 'uppercase',
    marginBottom: 6,
  };
  const divider = (
    <hr style={{ border: 'none', borderTop: '1px solid rgba(201,169,110,0.12)', margin: '8px 0' }} />
  );

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: '#142236', borderRight: '1px solid rgba(201,169,110,0.12)',
      padding: '20px 16px', alignSelf: 'flex-start',
      position: 'sticky', top: 52,
      minHeight: 'calc(100vh - 52px)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#c9a96e', marginBottom: 14, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Filter matches
      </div>

      {/* Match strength: single dual-handle slider */}
      <div style={{ ...SECTION_LABEL }}>
        Match strength &nbsp;
        <span style={{ color: 'rgba(253,252,248,0.65)', fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>
          {strength[0]}% – {strength[1]}%
        </span>
      </div>
      <DualRangeSlider min={0} max={100} step={1} values={strength} onChange={onStrength} />

      {divider}

      {/* Distance */}
      <div style={{ ...SECTION_LABEL }}>
        Distance
      </div>
      <div style={{ fontSize: 11, color: '#c9a96e', marginBottom: 2 }}>
        Within {distance >= 5000 ? '5000+' : distance} km
      </div>
      <SingleRangeSlider min={0} max={5000} step={50} value={distance} onChange={onDistance} />

      {divider}

      {/* Level pills */}
      <div style={{ ...SECTION_LABEL }}>Level</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LEVEL_KEYS.map(key => {
          const active = levels.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggleLevel(key)}
              style={{
                padding: '4px 9px', borderRadius: 2, fontSize: 10, cursor: 'pointer',
                background: active ? 'rgba(201,169,110,0.15)' : 'transparent',
                border: `1px solid ${active ? 'rgba(201,169,110,0.5)' : 'rgba(201,169,110,0.15)'}`,
                color: active ? '#c9a96e' : 'rgba(253,252,248,0.5)',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.12s', fontFamily: 'inherit',
              }}
            >
              {LEVEL_LABEL[key]}
            </button>
          );
        })}
      </div>

      {divider}

      {/* Discipline */}
      <div style={{ ...SECTION_LABEL }}>Discipline</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['ice_dance', 'pairs'].map(val => (
          <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor: '#c9a96e', width: 13, height: 13, flexShrink: 0, margin: 0 }} checked={disciplines.includes(val)} onChange={() => toggleDiscipline(val)} />
            <span style={{ fontSize: 12, color: 'rgba(253,252,248,0.65)' }}>{DISCIPLINE_LABEL[val]}</span>
          </label>
        ))}
      </div>

      {divider}

      {/* Role */}
      <div style={{ ...SECTION_LABEL }}>Role</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['man', 'lady', 'either'].map(val => (
          <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor: '#c9a96e', width: 13, height: 13, flexShrink: 0, margin: 0 }} checked={roles.includes(val)} onChange={() => toggleRole(val)} />
            <span style={{ fontSize: 12, color: 'rgba(253,252,248,0.65)' }}>{ROLE_LABEL[val]}</span>
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
  const [distance, setDistance]       = useState(saved?.distance       ?? 1000);
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
      <main style={{ background: '#0d1b2e', padding: '24px 28px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 300, color: '#fdfcf8' }}>Your matches</h1>
        <p style={{ color: 'rgba(253,252,248,0.65)', marginTop: 12 }}>
          You need a profile to see matches.{' '}
          <a href="/profile/new" style={{ color: '#c9a96e' }}>Create one</a>
        </p>
      </main>
    );
  }

  return (
    <div style={{ display: 'flex', background: '#0d1b2e', minHeight: 'calc(100vh - 52px)', alignItems: 'flex-start' }}>
      <Sidebar
        strength={strength} onStrength={setStrength}
        distance={distance} onDistance={setDistance}
        levels={levels} onLevels={setLevels}
        disciplines={disciplines} onDisciplines={setDisciplines}
        roles={roles} onRoles={setRoles}
      />

      <main style={{ flex: 1, padding: '24px 24px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 300, color: '#fdfcf8', marginBottom: 18 }}>
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
          <div style={{ textAlign: 'center', color: 'rgba(253,252,248,0.65)', fontSize: 14, marginTop: 60 }}>
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
