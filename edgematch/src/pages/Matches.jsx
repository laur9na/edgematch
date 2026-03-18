/**
 * Matches.jsx, Phase 8.1
 * Left sidebar (220px) with noUiSlider filters + main content area.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import noUiSlider from 'nouislider';
import 'nouislider/dist/nouislider.css';
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

const SORT_OPTIONS = [
  { value: 'score',    label: 'Match strength' },
  { value: 'distance', label: 'Distance' },
  { value: 'level',    label: 'Level' },
  { value: 'recent',   label: 'Recently active' },
];

const LEVEL_ORDER = ['pre_juvenile','juvenile','intermediate','novice','junior','senior','adult'];

// Dual-handle slider: match strength 40-100
function StrengthSlider({ value, onChange }) {
  const ref = useRef(null);
  const sliderRef = useRef(null);

  useEffect(() => {
    if (!ref.current || sliderRef.current) return;

    sliderRef.current = noUiSlider.create(ref.current, {
      start: value,
      connect: true,
      range: { min: 0, max: 100 },
      step: 1,
    });

    // Style the connect (filled) portion
    const connect = ref.current.querySelector('.noUi-connect');
    if (connect) connect.style.background = '#1a56db';

    sliderRef.current.on('update', (vals) => {
      onChange([Math.round(parseFloat(vals[0])), Math.round(parseFloat(vals[1]))]);
    });

    return () => {
      if (sliderRef.current) {
        sliderRef.current.destroy();
        sliderRef.current = null;
      }
    };
  }, []);

  return <div ref={ref} style={{ margin: '8px 4px 4px' }} />;
}

// Single slider: distance
function DistanceSlider({ value, onChange }) {
  const ref = useRef(null);
  const sliderRef = useRef(null);

  useEffect(() => {
    if (!ref.current || sliderRef.current) return;

    sliderRef.current = noUiSlider.create(ref.current, {
      start: value,
      connect: [true, false],
      range: { min: 0, max: 5000 },
      step: 50,
    });

    const connect = ref.current.querySelector('.noUi-connect');
    if (connect) connect.style.background = '#1a56db';

    sliderRef.current.on('update', (vals) => {
      onChange(Math.round(parseFloat(vals[0])));
    });

    return () => {
      if (sliderRef.current) {
        sliderRef.current.destroy();
        sliderRef.current = null;
      }
    };
  }, []);

  return <div ref={ref} style={{ margin: '8px 4px 4px' }} />;
}

// noUiSlider base handle/track styles injected once
function useSliderStyles() {
  useEffect(() => {
    const id = 'nouislider-custom';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .noUi-target { background: #e8eef7; border: none; box-shadow: none; }
      .noUi-handle {
        width: 14px !important; height: 14px !important;
        border-radius: 50% !important;
        background: #1a56db !important;
        border: 2px solid #fff !important;
        box-shadow: 0 1px 4px rgba(26,86,219,0.25) !important;
        top: -5px !important; right: -7px !important;
        cursor: pointer;
      }
      .noUi-handle::before, .noUi-handle::after { display: none !important; }
    `;
    document.head.appendChild(style);
  }, []);
}

function Sidebar({ strength, onStrength, distance, onDistance, levels, onLevels, disciplines, onDisciplines, roles, onRoles }) {
  useSliderStyles();

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

      {/* Match strength */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5a7a', marginBottom: 4 }}>
        Match strength
      </div>
      <div style={{ fontSize: 12, color: '#1a56db', marginBottom: 2 }}>
        {strength[0]}% to {strength[1]}%
      </div>
      <StrengthSlider value={strength} onChange={onStrength} />

      {divider}

      {/* Distance */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5a7a', marginBottom: 4 }}>
        Distance
      </div>
      <div style={{ fontSize: 12, color: '#1a56db', marginBottom: 2 }}>
        Within {distance === 5000 ? '5000+' : distance} km
      </div>
      <DistanceSlider value={distance} onChange={onDistance} />

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
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5a7a', marginBottom: 8 }}>
        Discipline
      </div>
      {['ice_dance', 'pairs'].map(val => (
        <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4a5a7a', cursor: 'pointer', marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={disciplines.includes(val)}
            onChange={() => toggleDiscipline(val)}
            style={{ accentColor: '#1a56db', width: 13, height: 13, flexShrink: 0, margin: 0 }}
          />
          <span>{DISCIPLINE_LABEL[val]}</span>
        </label>
      ))}

      {divider}

      {/* Role */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5a7a', marginBottom: 8 }}>
        Role
      </div>
      {['man', 'lady', 'either'].map(val => (
        <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4a5a7a', cursor: 'pointer', marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={roles.includes(val)}
            onChange={() => toggleRole(val)}
            style={{ accentColor: '#1a56db', width: 13, height: 13, flexShrink: 0, margin: 0 }}
          />
          <span>{ROLE_LABEL[val]}</span>
        </label>
      ))}
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
  const [disciplines, setDisciplines] = useState(saved?.disciplines    ?? []);
  const [roles, setRoles]             = useState(saved?.roles          ?? []);
  const [sort, setSort]               = useState(saved?.sort           ?? 'score');

  useEffect(() => {
    sessionStorage.setItem('matchFilters', JSON.stringify({ strength, distance, levels, disciplines, roles, sort }));
  }, [strength, distance, levels, disciplines, roles, sort]);

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

    if (sort === 'score') {
      list = [...list].sort((a, b) => b.total_score - a.total_score);
    } else if (sort === 'distance') {
      list = [...list].sort((a, b) => (b.location_score ?? 0) - (a.location_score ?? 0));
    } else if (sort === 'level') {
      list = [...list].sort((a, b) => {
        const ai = LEVEL_ORDER.indexOf(a.partner?.skating_level);
        const bi = LEVEL_ORDER.indexOf(b.partner?.skating_level);
        return ai - bi;
      });
    } else if (sort === 'recent') {
      // Proxy: sort by partner id desc (no last_active field)
      list = [...list].sort((a, b) => (b.partner?.id ?? 0) - (a.partner?.id ?? 0));
    }

    return list;
  }, [matches, strength, distance, levels, disciplines, roles, sort]);

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
    <div style={{ display: 'flex', background: '#f4f7fb', minHeight: 'calc(100vh - 56px)', alignItems: 'flex-start' }}>
      <Sidebar
        strength={strength} onStrength={setStrength}
        distance={distance} onDistance={setDistance}
        levels={levels} onLevels={setLevels}
        disciplines={disciplines} onDisciplines={setDisciplines}
        roles={roles} onRoles={setRoles}
      />

      <main style={{ flex: 1, padding: '24px 24px' }}>
        {/* Header row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 18,
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f2a5e', letterSpacing: '-0.3px' }}>
              Your matches
            </h1>
            <span style={{ fontSize: 12, color: '#7a8aaa' }}>
              {loading ? '...' : `${totalVisible} skaters`}
            </span>
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={{
              border: '1px solid #d4e0f5', borderRadius: 7, padding: '6px 10px',
              fontSize: 12, color: '#4a5a7a', background: '#fff', cursor: 'pointer',
            }}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
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
