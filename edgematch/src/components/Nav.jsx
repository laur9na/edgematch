import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AvatarDropdown() {
  const { user, athlete, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    navigate('/');
  }

  if (!user) return null;

  const initials = getInitials(athlete?.name || user.email || '?');
  const levelStr = athlete ? (LEVEL_LABEL[athlete.skating_level] ?? '') : '';
  const discStr  = athlete ? (DISCIPLINE_LABEL[athlete.discipline] ?? '') : '';
  const subline  = [levelStr, discStr].filter(Boolean).join(' · ');

  return (
    <div ref={ref} style={{ position: 'relative', marginLeft: 6 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(201,169,110,0.2)', color: '#c9a96e',
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', userSelect: 'none', border: '1px solid rgba(201,169,110,0.35)',
        }}
      >
        {initials}
      </div>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 38,
          background: '#142236', border: '1px solid rgba(201,169,110,0.2)',
          borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          minWidth: 180, zIndex: 100, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fdfcf8' }}>
              {athlete?.name ?? user.email}
            </div>
            {subline && (
              <div style={{ fontSize: 11, color: 'rgba(253,252,248,0.65)', marginTop: 2 }}>
                {subline}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(201,169,110,0.12)' }} />
          <button
            onClick={handleSignOut}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 16px', background: 'none', border: 'none',
              fontSize: 13, color: 'rgba(253,252,248,0.65)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const NAV_LINKS = ['About', 'Browse', 'Matches', 'Try-outs', 'Profile'];

function toPath(link) {
  return '/' + link.toLowerCase().replace('-', '').replace("'", '');
}

const MOBILE_ICONS = {
  Matches: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  'Try-outs': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Profile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
};

export default function Nav() {
  const { user } = useAuth();

  return (
    <>
      <nav style={{
        background: '#1a3a6b', height: 52, padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link to="/" style={{ color: '#c9a96e', fontFamily: "'Great Vibes', cursive", fontSize: 26, lineHeight: 1, textDecoration: 'none' }}>
          EdgeMatch
        </Link>

        <div className="nav-links-desktop" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {NAV_LINKS.map(link => (
            <NavLink
              key={link}
              to={toPath(link)}
              style={({ isActive }) => ({
                color: isActive ? '#c9a96e' : 'rgba(253,252,248,0.65)',
                background: isActive ? 'rgba(201,169,110,0.08)' : 'transparent',
                borderRadius: 4,
                fontSize: 13, padding: '6px 10px',
                textDecoration: 'none', fontWeight: isActive ? 700 : 400,
                fontFamily: "'Nunito', sans-serif",
              })}
            >
              {link}
            </NavLink>
          ))}
          {user ? (
            <AvatarDropdown />
          ) : (
            <NavLink
              to="/signup"
              style={({ isActive }) => ({
                color: isActive ? '#c9a96e' : '#c9a96e',
                background: 'transparent',
                border: '1px solid rgba(201,169,110,0.35)',
                fontSize: 13, padding: '5px 14px', borderRadius: 2,
                textDecoration: 'none', fontWeight: 600,
                fontFamily: "'Nunito', sans-serif",
              })}
            >
              Sign in
            </NavLink>
          )}
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-bottom-nav">
        {['Matches', 'Try-outs', 'Profile'].map(link => (
          <NavLink
            key={link}
            to={toPath(link)}
            className={({ isActive }) => `mobile-tab${isActive ? ' active' : ''}`}
          >
            <span className="mobile-tab-icon">{MOBILE_ICONS[link]}</span>
            <span className="mobile-tab-label">{link}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
