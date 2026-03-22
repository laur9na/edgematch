/**
 * Landing.jsx
 * Hero + How it works. Dark luxury design system.
 */
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const HOW_IT_WORKS = [
  {
    n: '1',
    title: 'Build your profile',
    desc: 'Tell us your discipline, level, height, location, and goals. Takes about 3 minutes.',
  },
  {
    n: '2',
    title: 'See your matches',
    desc: 'We score compatibility across height, level, role, and distance then rank your best fits.',
  },
  {
    n: '3',
    title: 'Skate together',
    desc: 'Request a try-out directly through the app. Confirm, log outcomes, and track your search.',
  },
];

export default function Landing() {
  const { session, profileComplete } = useAuth();
  const navigate = useNavigate();

  function handleCTA() {
    if (session) return navigate('/browse');
    navigate('/signup');
  }

  return (
    <main style={{ background: '#0d1b2e' }}>

      {/* Hero */}
      <section style={{ padding: '72px 40px 56px', maxWidth: 680 }}>
        <div style={{
          fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em',
          color: '#c9a96e', textTransform: 'uppercase', marginBottom: 20,
        }}>
          Competitive pairs and ice dance
        </div>
        <h1 style={{
          fontSize: '2.8rem', fontWeight: 300, color: '#fdfcf8',
          lineHeight: 1.18, letterSpacing: '-0.02em', marginBottom: 20,
        }}>
          The right partner<br />changes everything.
        </h1>
        <p style={{
          color: 'rgba(253,252,248,0.65)', fontSize: '0.95rem', lineHeight: 1.75,
          maxWidth: 420, marginBottom: 36,
        }}>
          Data-driven partner matching for pairs and ice dance skaters.
          Replace Facebook posts and coaching favors with something better.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={handleCTA}
            style={{
              background: '#c9a96e', color: '#0d1b2e', border: 'none',
              padding: '12px 32px', borderRadius: 2, fontWeight: 700,
              fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}
          >
            Find my partner
          </button>
          <Link
            to="/about"
            style={{
              background: 'transparent', color: '#c9a96e',
              border: '1px solid rgba(201,169,110,0.35)',
              padding: '11px 28px', borderRadius: 2,
              fontSize: '0.78rem', textDecoration: 'none', display: 'inline-block',
              fontWeight: 600, letterSpacing: '0.08em',
            }}
          >
            How it works
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '0 40px 64px' }}>
        <div style={{
          fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em',
          color: '#c9a96e', textTransform: 'uppercase', marginBottom: 24,
        }}>
          The process
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16,
          maxWidth: 860,
        }} className="how-steps-grid">
          {HOW_IT_WORKS.map(s => (
            <div key={s.n} style={{
              background: '#142236', border: '1px solid rgba(201,169,110,0.12)',
              borderRadius: 4, padding: '24px 22px',
              transition: 'border-color 250ms, transform 250ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.35)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.12)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: '#c9a96e',
                color: '#0d1b2e', fontSize: '0.75rem', fontWeight: 700, marginBottom: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.n}
              </div>
              <h3 style={{
                fontSize: '0.88rem', fontWeight: 600, color: '#fdfcf8', marginBottom: 8,
              }}>
                {s.title}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'rgba(253,252,248,0.65)', lineHeight: 1.65 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
