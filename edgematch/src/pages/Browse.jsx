/**
 * Browse.jsx (Phase 1.3)
 * Two-panel layout: left 240px filter panel, right club cards grid.
 * Left panel: gold labels, level pills, discipline/role checkboxes.
 * Right panel: club cards in 2-column grid.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClubs } from '../hooks/useClubs';

const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };

const ROLE_LABEL = { man: 'Man', lady: 'Lady' };

const FEDERATION_LABEL = {
  usfs: 'USFS', isu: 'ISU', skate_canada: 'Skate Canada',
  ffsg: 'FFSG', fisg: 'FISG',
};

function FilterLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: '#c9a96e', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid rgba(201,169,110,0.1)', margin: '16px 0' }} />;
}

function FilterPanel({ disciplines, onDisciplines, roles, onRoles, country, onCountry }) {
  function toggleDiscipline(val) {
    onDisciplines(prev => prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]);
  }
  function toggleRole(val) {
    onRoles(prev => prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]);
  }

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: '#142236', borderRight: '1px solid rgba(201,169,110,0.1)',
      padding: '24px 18px', alignSelf: 'flex-start',
      position: 'sticky', top: 52,
      minHeight: 'calc(100vh - 52px)',
    }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: '#c9a96e', marginBottom: 20, textTransform: 'uppercase' }}>
        Filter clubs
      </div>

      <FilterLabel>Country</FilterLabel>
      <input
        type="text"
        placeholder="e.g. United States"
        value={country}
        onChange={e => onCountry(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px', fontSize: '0.78rem',
          background: '#1c3050', border: '1px solid rgba(201,169,110,0.2)',
          borderRadius: 2, color: '#fdfcf8', fontFamily: 'inherit',
          marginBottom: 0,
        }}
      />

      <Divider />

      <FilterLabel>Discipline</FilterLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['pairs', 'ice_dance'].map(val => (
          <label key={val} style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem',
            color: 'rgba(253,252,248,0.65)', cursor: 'pointer',
            textTransform: 'none', letterSpacing: 0, fontWeight: 400,
          }}>
            <input type="checkbox"
              style={{ margin: 0, flexShrink: 0, accentColor: '#c9a96e' }}
              checked={disciplines.includes(val)}
              onChange={() => toggleDiscipline(val)}
            />
            <span>{DISCIPLINE_LABEL[val]}</span>
          </label>
        ))}
      </div>

      <Divider />

      <FilterLabel>Role</FilterLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['man', 'lady'].map(val => (
          <label key={val} style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem',
            color: 'rgba(253,252,248,0.65)', cursor: 'pointer',
            textTransform: 'none', letterSpacing: 0, fontWeight: 400,
          }}>
            <input type="checkbox"
              style={{ margin: 0, flexShrink: 0, accentColor: '#c9a96e' }}
              checked={roles.includes(val)}
              onChange={() => toggleRole(val)}
            />
            <span>{ROLE_LABEL[val]}</span>
          </label>
        ))}
      </div>
    </aside>
  );
}

// Pastel avatar circles using first letter of club name
const AVATAR_COLORS = [
  { bg: 'rgba(201,169,110,0.15)', color: '#c9a96e' },
  { bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc' },
  { bg: 'rgba(22,163,74,0.15)',   color: '#4ade80' },
  { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
];

function ClubCard({ club, index, onClick }) {
  const avatarStyle = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial = (club.name ?? '?')[0].toUpperCase();
  const location = [club.city, club.state].filter(Boolean).join(', ');
  const disciplines = club.disciplines ?? [];
  const athleteCount = club.athlete_count ?? 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#142236', border: '1px solid rgba(201,169,110,0.12)',
        borderRadius: 4, padding: 20, cursor: 'pointer',
        transition: 'border-color 250ms, transform 250ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(201,169,110,0.35)';
        e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(201,169,110,0.12)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* Club avatar + name */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: avatarStyle.bg, color: avatarStyle.color,
          fontSize: '0.9rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fdfcf8', lineHeight: 1.3 }}>
            {club.name}
          </div>
        </div>
      </div>


      {/* Discipline tags */}
      {disciplines.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          {disciplines.map(d => (
            <span key={d} style={{
              fontSize: '0.65rem', padding: '2px 7px', borderRadius: 2,
              background: 'rgba(253,252,248,0.06)', color: 'rgba(253,252,248,0.5)',
              border: '1px solid rgba(253,252,248,0.08)',
            }}>
              {DISCIPLINE_LABEL[d] ?? d}
            </span>
          ))}
        </div>
      )}

      {/* Footer: skater count + view link */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.4)' }}>
          {athleteCount > 0 ? `${athleteCount} skater${athleteCount !== 1 ? 's' : ''}` : ''}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#c9a96e', fontWeight: 600 }}>
          View club &rarr;
        </span>
      </div>
    </div>
  );
}

export default function Browse() {
  const navigate = useNavigate();
  const { data: clubs = [], isLoading: loading, error: queryError } = useClubs();
  const error = queryError?.message ?? null;

  const [disciplines, setDisciplines] = useState(['pairs', 'ice_dance']);
  const [roles, setRoles]             = useState(['man', 'lady']);
  const [country, setCountry]         = useState('');

  const filtered = useMemo(() => {
    return clubs.filter(c => {
      if (country.trim()) {
        const q = country.trim().toLowerCase();
        if (!(c.country ?? '').toLowerCase().includes(q) &&
            !(c.state ?? '').toLowerCase().includes(q) &&
            !(c.city ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [clubs, country]);

  return (
    <div style={{ display: 'flex', background: '#0d1b2e', minHeight: 'calc(100vh - 52px)', alignItems: 'flex-start' }}>
      <FilterPanel
        disciplines={disciplines} onDisciplines={setDisciplines}
        roles={roles} onRoles={setRoles}
        country={country} onCountry={setCountry}
      />

      <main style={{ flex: 1, padding: '28px 28px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 300, color: '#fdfcf8', marginBottom: 4 }}>
            Browse clubs
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.5)' }}>
            {loading ? '' : `${filtered.length} club${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {error && (
          <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: 16 }}>{error}</div>
        )}

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card-skeleton" style={{ height: 160 }} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(253,252,248,0.4)', fontSize: '0.85rem', marginTop: 80 }}>
            No clubs found. Try adjusting filters.
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            {filtered.map((club, i) => (
              <ClubCard
                key={club.id}
                club={club}
                index={i}
                onClick={() => navigate(`/clubs/${club.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
