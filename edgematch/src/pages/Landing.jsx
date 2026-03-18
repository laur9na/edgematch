/**
 * Landing.jsx, Phase 7.2
 * Hero + How it works. Two sections.
 */
import { Link } from 'react-router-dom';

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
  return (
    <main style={{ background: '#f4f7fb' }}>

      {/* Section 1 Hero */}
      <section style={{ background: '#f4f7fb', padding: '52px 28px 40px' }}>
        <h1 style={{
          fontSize: 34, fontWeight: 800, color: '#0f2a5e',
          maxWidth: 420, lineHeight: 1.15, letterSpacing: '-0.3px',
        }}>
          The right partner changes everything.
        </h1>
        <p style={{
          color: '#4a5a7a', fontSize: 15, marginTop: 12, maxWidth: 380,
        }}>
          AI-powered matching for competitive pairs and ice dance skaters.
        </p>
        <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            to="/signup"
            style={{
              background: '#1a56db', color: '#fff', border: 'none',
              padding: '10px 22px', borderRadius: 8, fontWeight: 600,
              fontSize: 14, textDecoration: 'none', display: 'inline-block',
            }}
          >
            Find my partner
          </Link>
          <Link
            to="/admin"
            style={{
              background: '#fff', color: '#1a3a6b',
              border: '1.5px solid #c5d3eb',
              padding: '10px 18px', borderRadius: 8,
              fontSize: 14, textDecoration: 'none', display: 'inline-block',
            }}
          >
            I&apos;m a coach
          </Link>
        </div>
      </section>

      {/* Section 2 How it works */}
      <section style={{ padding: '32px 28px' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '1.2px',
          color: '#1a56db', textTransform: 'uppercase', marginBottom: 14,
        }}>
          HOW IT WORKS
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12,
        }} className="how-steps-grid">
          {HOW_IT_WORKS.map(s => (
            <div key={s.n} style={{
              background: '#fff', border: '1px solid #d4e0f5',
              borderRadius: 12, padding: '18px 16px',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#1a56db',
                color: '#fff', fontSize: 12, fontWeight: 700, marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.n}
              </div>
              <h3 style={{
                fontSize: 13, fontWeight: 700, color: '#0f2a5e', marginBottom: 6,
              }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 12, color: '#5a6a8a', lineHeight: 1.55 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
