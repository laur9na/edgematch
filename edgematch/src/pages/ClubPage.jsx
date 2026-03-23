/**
 * ClubPage.jsx (Phase 1.4)
 * /clubs/:id: Club info card and athlete roster.
 * Top card: name, rink, city, country. Contact links right-aligned in gold.
 * Roster: filter pills, athlete cards in 2-column grid.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useClub } from '../hooks/useClub';
import { useAthletes } from '../hooks/useAthletes';
import TryoutModal from '../components/TryoutModal';

const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };
const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const ROLE_LABEL = {
  lady: 'Skates as lady', man: 'Skates as man',
};

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function lastInitial(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function heightStr(cm) {
  if (!cm) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return `${ft}'${inches}"`;
}

const AVATAR_COLORS = [
  { bg: 'rgba(201,169,110,0.15)', color: '#c9a96e' },
  { bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc' },
  { bg: 'rgba(22,163,74,0.15)',   color: '#4ade80' },
  { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
];

function AthleteRosterCard({ athlete, index, onTryout, onProfile }) {
  const avatarStyle = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const loc = [athlete.location_city, athlete.location_state].filter(Boolean).join(', ');
  const ht = heightStr(athlete.height_cm);

  return (
    <div
      onClick={onProfile}
      style={{
        background: '#1c3050', border: '1px solid rgba(201,169,110,0.12)',
        borderRadius: 4, padding: 18, cursor: 'pointer',
        transition: 'border-color 250ms, transform 250ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.12)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {athlete.profile_photo_url ? (
          <img src={athlete.profile_photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: avatarStyle.bg, color: avatarStyle.color,
            fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {getInitials(athlete.name)}
          </div>
        )}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fdfcf8' }}>
            {lastInitial(athlete.name)}
          </div>
          {athlete.skating_level && (
            <span style={{
              fontSize: '0.6rem', background: 'rgba(201,169,110,0.12)', color: '#c9a96e',
              padding: '1px 6px', borderRadius: 2, fontWeight: 600, letterSpacing: '0.06em',
            }}>
              {LEVEL_LABEL[athlete.skating_level] ?? athlete.skating_level}
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.55)', marginBottom: 6 }}>
        {[
          DISCIPLINE_LABEL[athlete.discipline],
          ROLE_LABEL[athlete.partner_role],
        ].filter(Boolean).join(' · ')}
      </div>
      {(loc || ht) && (
        <div style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.4)', marginBottom: 10 }}>
          {[loc, ht].filter(Boolean).join(' · ')}
        </div>
      )}
      {athlete.coach_name && (
        <div style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.4)', marginBottom: 10 }}>
          Coach: {athlete.coach_name}
        </div>
      )}

      {/* Try-out button */}
      <button
        onClick={e => { e.stopPropagation(); onTryout(athlete); }}
        style={{
          width: '100%', padding: '7px 0',
          background: '#c9a96e', color: '#0d1b2e', border: 'none',
          borderRadius: 2, fontSize: '0.7rem', fontWeight: 700,
          cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit',
        }}
      >
        Request try-out
      </button>
    </div>
  );
}

export default function ClubPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { athlete: myAthlete } = useAuth();

  const { data: club = null, isLoading: clubLoading } = useClub(id);
  const { data: athletes = [] } = useAthletes(id);

  const [filterDisc, setFilterDisc] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterName, setFilterName] = useState('');
  const [modalAthlete, setModalAthlete] = useState(null);

  const disciplines = [...new Set(athletes.map(a => a.discipline).filter(Boolean))];
  const levels = [...new Set(athletes.map(a => a.skating_level).filter(Boolean))];

  const filtered = athletes.filter(a => {
    if (filterDisc && a.discipline !== filterDisc) return false;
    if (filterLevel && a.skating_level !== filterLevel) return false;
    if (filterName.trim() && !(a.name ?? '').toLowerCase().includes(filterName.trim().toLowerCase())) return false;
    return true;
  });

  if (clubLoading) return <div className="loading">Loading...</div>;

  if (!club) {
    return (
      <main style={{ background: '#0d1b2e', padding: '24px 28px' }}>
        <p style={{ color: 'rgba(253,252,248,0.65)' }}>Club not found.</p>
      </main>
    );
  }


  return (
    <main style={{ background: '#0d1b2e', minHeight: 'calc(100vh - 52px)', padding: '24px 28px' }}>

      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          marginBottom: 20, background: 'none', border: 'none',
          fontSize: '0.75rem', color: '#c9a96e', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
        }}
      >
        &larr; Browse clubs
      </button>

      {/* Club info card */}
      <div style={{
        background: '#142236', border: '1px solid rgba(201,169,110,0.15)',
        borderRadius: 4, padding: '22px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 300, color: '#fdfcf8', marginBottom: 4 }}>
              {club.name}
            </h1>
            {club.rink_name && (
              <div style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.65)', marginBottom: 2 }}>
                {club.rink_name}
              </div>
            )}
            <div style={{ fontSize: '0.78rem', color: 'rgba(253,252,248,0.45)' }}>
              {[club.city, club.state, club.country].filter(Boolean).join(', ')}
            </div>
          </div>

          {/* Contact links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            {club.website && (
              <a href={club.website} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.78rem', color: '#c9a96e', textDecoration: 'none' }}>
                Website &rarr;
              </a>
            )}
            {club.rink_address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(club.rink_address)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.78rem', color: '#c9a96e', textDecoration: 'none' }}>
                Directions &rarr;
              </a>
            )}
            {club.contact_email && (
              <a href={`mailto:${club.contact_email}`}
                style={{ fontSize: '0.78rem', color: '#c9a96e', textDecoration: 'none' }}>
                {club.contact_email}
              </a>
            )}
            {club.phone && (
              <a href={`tel:${club.phone}`}
                style={{ fontSize: '0.78rem', color: '#c9a96e', textDecoration: 'none' }}>
                {club.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Roster section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.14em', color: '#c9a96e', textTransform: 'uppercase', marginBottom: 12 }}>
          Athletes searching for partners
        </div>

        {/* Name search */}
        <input
          type="text"
          placeholder="Search by name..."
          value={filterName}
          onChange={e => setFilterName(e.target.value)}
          style={{
            width: '100%', maxWidth: 320, padding: '8px 12px', marginBottom: 14,
            background: '#1c3050', border: '1px solid rgba(201,169,110,0.2)',
            borderRadius: 2, color: '#fdfcf8', fontSize: '0.82rem', fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />

        {/* Filter pills */}
        {(disciplines.length > 1 || levels.length > 1) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {disciplines.length > 1 && ['', ...disciplines].map(d => (
              <button
                key={d || 'all-disc'}
                onClick={() => setFilterDisc(d)}
                style={{
                  padding: '4px 10px', borderRadius: 2, fontSize: '0.72rem', cursor: 'pointer',
                  background: filterDisc === d ? 'rgba(201,169,110,0.15)' : 'transparent',
                  border: `1px solid ${filterDisc === d ? 'rgba(201,169,110,0.5)' : 'rgba(201,169,110,0.15)'}`,
                  color: filterDisc === d ? '#c9a96e' : 'rgba(253,252,248,0.45)',
                  fontFamily: 'inherit', fontWeight: filterDisc === d ? 600 : 400,
                }}
              >
                {d ? (DISCIPLINE_LABEL[d] ?? d) : 'All disciplines'}
              </button>
            ))}
            {levels.length > 1 && ['', ...levels].map(l => (
              <button
                key={l || 'all-level'}
                onClick={() => setFilterLevel(l)}
                style={{
                  padding: '4px 10px', borderRadius: 2, fontSize: '0.72rem', cursor: 'pointer',
                  background: filterLevel === l ? 'rgba(201,169,110,0.15)' : 'transparent',
                  border: `1px solid ${filterLevel === l ? 'rgba(201,169,110,0.5)' : 'rgba(201,169,110,0.15)'}`,
                  color: filterLevel === l ? '#c9a96e' : 'rgba(253,252,248,0.45)',
                  fontFamily: 'inherit', fontWeight: filterLevel === l ? 600 : 400,
                }}
              >
                {l ? (LEVEL_LABEL[l] ?? l) : 'All levels'}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{ color: 'rgba(253,252,248,0.4)', fontSize: '0.85rem', padding: '40px 0', textAlign: 'center' }}>
            No athletes found.
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            {filtered.map((athlete, i) => (
              <AthleteRosterCard
                key={athlete.id}
                athlete={athlete}
                index={i}
                onTryout={setModalAthlete}
                onProfile={() => navigate(`/skater/${athlete.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {modalAthlete && (
        <TryoutModal
          match={{ id: null, partner: modalAthlete }}
          onClose={() => setModalAthlete(null)}
          onSuccess={() => setModalAthlete(null)}
        />
      )}
    </main>
  );
}
