/**
 * Browse.jsx
 * Two tabs: Clubs | All athletes.
 * Clubs: left filter panel + club card grid.
 * All athletes: name search + discipline/role filters + athlete card grid.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
import { useClubs } from '../hooks/useClubs';
import { useAthletes } from '../hooks/useAthletes';
import TryoutModal from '../components/TryoutModal';

const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };
const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const ROLE_LABEL = { man: 'Skates as man', lady: 'Skates as lady' };

const AVATAR_COLORS = [
  { bg: 'rgba(201,169,110,0.15)', color: '#c9a96e' },
  { bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc' },
  { bg: 'rgba(22,163,74,0.15)',   color: '#4ade80' },
  { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ---------- Club card ---------- */
function ClubCard({ club, index, onClick }) {
  const avatarStyle = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial = (club.name ?? '?')[0].toUpperCase();
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
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.35)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.12)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: avatarStyle.bg, color: avatarStyle.color,
          fontSize: '0.9rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initial}
        </div>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fdfcf8', lineHeight: 1.3 }}>
          {club.name}
        </div>
      </div>

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

/* ---------- Athlete card (All athletes tab) ---------- */
function AthleteCard({ athlete, index, onTryout, onProfile }) {
  const avatarStyle = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const meta = [
    DISCIPLINE_LABEL[athlete.discipline],
    ROLE_LABEL[athlete.partner_role],
    LEVEL_LABEL[athlete.skating_level] ?? athlete.skating_level,
  ].filter(Boolean).join(' · ');

  return (
    <div
      onClick={onProfile}
      style={{
        background: '#142236', border: '1px solid rgba(201,169,110,0.12)',
        borderRadius: 4, padding: 18, cursor: 'pointer',
        transition: 'border-color 250ms, transform 250ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.12)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: avatarStyle.bg, color: avatarStyle.color,
          fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {getInitials(athlete.name)}
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fdfcf8' }}>
            {athlete.name}
          </div>
          {athlete.club_name && (
            <div style={{ fontSize: '0.68rem', color: 'rgba(253,252,248,0.4)', marginTop: 1 }}>
              {athlete.club_name}
            </div>
          )}
        </div>
      </div>

      {meta && (
        <div style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.55)', marginBottom: 12 }}>
          {meta}
        </div>
      )}

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

/* ---------- Athletes filter panel (sidebar) ---------- */
function AthleteFilterPanel({ nameSearch, onNameSearch, disc, onDisc, role, onRole }) {
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: '#142236', borderRight: '1px solid rgba(201,169,110,0.1)',
      padding: '24px 18px', alignSelf: 'flex-start',
      position: 'sticky', top: 52, minHeight: 'calc(100vh - 52px)',
    }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: '#c9a96e', marginBottom: 20, textTransform: 'uppercase' }}>
        Filter athletes
      </div>
      <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 8 }}>Name</div>
      <input
        type="text"
        placeholder="Search by name..."
        value={nameSearch}
        onChange={e => onNameSearch(e.target.value)}
        style={{ ...inputStyle, marginBottom: 16 }}
        autoComplete="off"
      />
      <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 8 }}>Discipline</div>
      {['', 'pairs', 'ice_dance'].map(val => (
        <label key={val || 'all'} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'rgba(253,252,248,0.65)', cursor: 'pointer', marginBottom: 6 }}>
          <input type="radio" name="disc" checked={disc === val} onChange={() => onDisc(val)} style={{ margin: 0, accentColor: '#c9a96e' }} />
          {val ? (DISCIPLINE_LABEL[val] ?? val) : 'All'}
        </label>
      ))}
      <hr style={{ border: 'none', borderTop: '1px solid rgba(201,169,110,0.1)', margin: '14px 0' }} />
      <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 8 }}>Role</div>
      {['', 'man', 'lady'].map(val => (
        <label key={val || 'all'} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'rgba(253,252,248,0.65)', cursor: 'pointer', marginBottom: 6 }}>
          <input type="radio" name="role" checked={role === val} onChange={() => onRole(val)} style={{ margin: 0, accentColor: '#c9a96e' }} />
          {val ? ({ man: 'Man', lady: 'Lady' }[val]) : 'All'}
        </label>
      ))}
    </aside>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: '0.78rem',
  background: '#1c3050', border: '1px solid rgba(201,169,110,0.2)',
  borderRadius: 2, color: '#fdfcf8', fontFamily: 'inherit', boxSizing: 'border-box',
};

/* ---------- Main component ---------- */
export default function Browse() {
  const navigate = useNavigate();
  const { data: allAthletes = [], isLoading: athletesLoading } = useAthletes();

  const [view, setView] = useState('clubs');

  // Club pagination state
  const [clubPage, setClubPage] = useState(0);
  const [allClubs, setAllClubs] = useState([]);

  const { data: clubPageData, isLoading: clubsLoading, error: clubsError } = useClubs(clubPage);

  useEffect(() => {
    if (!clubPageData) return;
    setAllClubs(prev => clubPage === 0 ? clubPageData.rows : [...prev, ...clubPageData.rows]);
  }, [clubPageData, clubPage]);

  // Reset pagination when switching to clubs tab.
  // Do NOT clear allClubs; clearing it while clubPage/clubPageData haven't changed
  // means the repopulation effect never re-fires, leaving 0 clubs displayed.
  useEffect(() => {
    if (view === 'clubs') setClubPage(0);
  }, [view]);

  const hasMoreClubs = clubPageData?.hasMore ?? false;

  const [clubSearchInput, setClubSearchInput] = useState('');
  const clubSearch = useDebounce(clubSearchInput, 300);

  const [nameSearchInput, setNameSearchInput] = useState('');
  const nameSearch = useDebounce(nameSearchInput, 300);

  const [disc, setDisc] = useState('');
  const [role, setRole] = useState('');
  const [modalAthlete, setModalAthlete] = useState(null);

  const filteredClubs = useMemo(() => {
    if (!clubSearch.trim()) return allClubs;
    const q = clubSearch.trim().toLowerCase();
    return allClubs.filter(c => (c.name ?? '').toLowerCase().includes(q));
  }, [allClubs, clubSearch]);

  const filteredAthletes = useMemo(() => {
    return allAthletes.filter(a => {
      if (nameSearch.trim() && !(a.name ?? '').toLowerCase().includes(nameSearch.trim().toLowerCase())) return false;
      if (disc && a.discipline !== disc) return false;
      if (role && a.partner_role !== role) return false;
      return true;
    });
  }, [allAthletes, nameSearch, disc, role]);

  const tabStyle = active => ({
    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '0.82rem', fontWeight: active ? 700 : 400,
    color: active ? '#c9a96e' : 'rgba(253,252,248,0.5)',
    padding: '6px 0',
    borderBottom: `2px solid ${active ? '#c9a96e' : 'transparent'}`,
    marginRight: 24,
  });

  return (
    <div style={{ display: 'flex', background: '#0d1b2e', minHeight: 'calc(100vh - 52px)', alignItems: 'flex-start' }}>
      {view === 'athletes' && (
        <AthleteFilterPanel
          nameSearch={nameSearchInput} onNameSearch={setNameSearchInput}
          disc={disc} onDisc={setDisc}
          role={role} onRole={setRole}
        />
      )}

      <main style={{ flex: 1, padding: '28px 28px' }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid rgba(201,169,110,0.1)', paddingBottom: 0 }}>
          <button style={tabStyle(view === 'clubs')} onClick={() => setView('clubs')}>Clubs</button>
          <button style={tabStyle(view === 'athletes')} onClick={() => setView('athletes')}>All athletes</button>
        </div>

        {/* Clubs view */}
        {view === 'clubs' && (
          <>
            <input
              type="text"
              placeholder="Search clubs..."
              value={clubSearchInput}
              onChange={e => setClubSearchInput(e.target.value)}
              style={{ ...inputStyle, maxWidth: 320, marginBottom: 16 }}
            />
            <p style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.5)', marginBottom: 20 }}>
              {clubsLoading && allClubs.length === 0 ? '' : `${filteredClubs.length} club${filteredClubs.length !== 1 ? 's' : ''}`}
            </p>
            {clubsError && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: 16 }}>{clubsError.message}</div>}
            {clubsLoading && allClubs.length === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                {[...Array(6)].map((_, i) => <div key={i} className="card-skeleton" style={{ height: 160 }} />)}
              </div>
            )}
            {filteredClubs.length === 0 && !clubsLoading && (
              <div style={{ textAlign: 'center', color: 'rgba(253,252,248,0.4)', fontSize: '0.85rem', marginTop: 80 }}>
                No clubs found.
              </div>
            )}
            {filteredClubs.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                {filteredClubs.map((club, i) => (
                  <ClubCard key={club.id} club={club} index={i} onClick={() => navigate(`/clubs/${club.id}`)} />
                ))}
              </div>
            )}
            {hasMoreClubs && !clubSearch.trim() && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                {clubsLoading ? (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(201,169,110,0.3)', borderTopColor: '#c9a96e', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                ) : (
                  <button
                    onClick={() => setClubPage(p => p + 1)}
                    style={{
                      background: 'none', border: '1px solid rgba(201,169,110,0.3)', color: '#c9a96e',
                      padding: '8px 24px', borderRadius: 2, fontSize: '0.78rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em',
                    }}
                  >
                    Load more
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* All athletes view */}
        {view === 'athletes' && (
          <>
            <p style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.5)', marginBottom: 20 }}>
              {athletesLoading ? '' : `${filteredAthletes.length} athlete${filteredAthletes.length !== 1 ? 's' : ''}`}
            </p>
            {athletesLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                {[...Array(6)].map((_, i) => <div key={i} className="card-skeleton" style={{ height: 140 }} />)}
              </div>
            )}
            {!athletesLoading && filteredAthletes.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(253,252,248,0.4)', fontSize: '0.85rem', marginTop: 80 }}>
                No athletes found.
              </div>
            )}
            {!athletesLoading && filteredAthletes.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                {filteredAthletes.map((athlete, i) => (
                  <AthleteCard
                    key={athlete.id}
                    athlete={athlete}
                    index={i}
                    onProfile={() => navigate(`/athletes/${athlete.id}`)}
                    onTryout={setModalAthlete}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {modalAthlete && (
        <TryoutModal
          match={{ id: null, partner: modalAthlete }}
          onClose={() => setModalAthlete(null)}
          onSuccess={() => setModalAthlete(null)}
        />
      )}
    </div>
  );
}
