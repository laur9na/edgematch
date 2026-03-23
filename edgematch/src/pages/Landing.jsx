/**
 * Landing.jsx
 * Public landing page for edgematch.co.
 * Sections: Hero, Why Us, Product Screenshot, Second CTA.
 * Dark luxury design — navy, gold, Nunito.
 */
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function Hero() {
  return (
    <section className="landing-section" style={{
      padding: '72px 40px 64px',
      maxWidth: 680,
    }}>
      <div style={{
        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em',
        color: '#c9a96e', textTransform: 'uppercase', marginBottom: 20,
      }}>
        Competitive pairs and ice dance
      </div>
      <h1 style={{
        fontSize: '3rem', fontWeight: 300, color: '#fdfcf8',
        lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 20,
      }}>
        Find your skating partner.
      </h1>
      <p style={{
        color: 'rgba(253,252,248,0.7)', fontSize: '1rem', lineHeight: 1.75,
        maxWidth: 480, marginBottom: 36,
      }}>
        I'm a 3x National finalist who built a data-driven way to find compatible pairs
        and ice dance partners. Tell me what you're looking for — I'll find your matches personally.
      </p>
      <Link
        to="/signup"
        className="landing-cta-btn"
        style={{
          display: 'inline-block',
          background: '#c9a96e', color: '#0d1b2e', border: 'none',
          padding: '14px 40px', borderRadius: 2, fontWeight: 700,
          fontSize: '0.85rem', textDecoration: 'none',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        Get me matched
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Why Us
// ---------------------------------------------------------------------------
const WHY_US = [
  {
    title: 'Not just a listing board',
    body: 'IcePartnerSearch shows you a list. EdgeMatch scores compatibility by level, height ratio, role, jump direction, and location — then I personally review your matches before sending them.',
  },
  {
    title: 'Competition data built in',
    body: "Your matches come with their actual competition history — events, placements, levels. No guessing whether someone is actually at your level.",
  },
  {
    title: 'Club context included',
    body: 'Every match shows their training club, coach, and contact info. You know exactly who to reach out to and how.',
  },
];

function WhyUs() {
  return (
    <section className="landing-section" style={{ padding: '0 40px 72px' }}>
      <div style={{
        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em',
        color: '#c9a96e', textTransform: 'uppercase', marginBottom: 28,
      }}>
        Why EdgeMatch
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        maxWidth: 860,
      }} className="how-steps-grid">
        {WHY_US.map((item, i) => (
          <div key={i} style={{
            background: '#142236', border: '1px solid rgba(201,169,110,0.12)',
            borderRadius: 4, padding: '24px 22px',
            transition: 'border-color 250ms, transform 250ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.35)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.12)'; e.currentTarget.style.transform = 'none'; }}
          >
            <h3 style={{
              fontSize: '0.92rem', fontWeight: 700, color: '#fdfcf8', marginBottom: 12,
            }}>
              {item.title}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.65)', lineHeight: 1.7 }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Product screenshot
// ---------------------------------------------------------------------------
function ProductDemo() {
  return (
    <section className="landing-section" style={{ padding: '0 40px 72px', maxWidth: 900 }}>
      <div style={{
        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em',
        color: '#c9a96e', textTransform: 'uppercase', marginBottom: 20,
      }}>
        The product
      </div>
      <p style={{
        fontSize: '0.9rem', color: 'rgba(253,252,248,0.65)', marginBottom: 24, lineHeight: 1.6,
      }}>
        This is what your matches look like.
      </p>
      <div style={{
        background: '#142236', border: '1px solid rgba(201,169,110,0.15)',
        borderRadius: 6, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          background: '#1a3a6b', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(253,252,248,0.15)' }} />
          ))}
          <div style={{
            flex: 1, marginLeft: 8, background: 'rgba(253,252,248,0.06)',
            borderRadius: 2, height: 20, maxWidth: 260,
            display: 'flex', alignItems: 'center', padding: '0 10px',
          }}>
            <span style={{ fontSize: 10, color: 'rgba(253,252,248,0.3)' }}>app.edgematch.co/matches</span>
          </div>
        </div>

        {/* Mock match card */}
        <div style={{ padding: '24px 24px 28px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#c9a96e', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
            Your matches
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              { initials: 'SK', name: 'Sarah K.', level: 'Junior', disc: 'Pairs', score: 94, club: 'Detroit SC', ht: "5'4\"" },
              { initials: 'MR', name: 'Maya R.', level: 'Senior', disc: 'Ice dance', score: 88, club: 'Chicago FSC', ht: "5'3\"" },
            ].map((m, i) => (
              <div key={i} style={{
                background: '#1c3050', border: '1px solid rgba(201,169,110,0.15)',
                borderRadius: 4, padding: 16,
              }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: i === 0 ? 'rgba(201,169,110,0.15)' : 'rgba(99,102,241,0.15)',
                    color: i === 0 ? '#c9a96e' : '#a5b4fc',
                    fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {m.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fdfcf8', marginBottom: 2 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(253,252,248,0.5)' }}>{m.disc} · {m.level}</div>
                  </div>
                  <div style={{
                    background: 'rgba(201,169,110,0.12)', color: '#c9a96e',
                    fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 2,
                  }}>
                    {m.score}%
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(253,252,248,0.4)', marginBottom: 4 }}>{m.ht} · {m.club}</div>
                <div style={{ height: 4, background: 'rgba(201,169,110,0.12)', borderRadius: 99, marginTop: 10 }}>
                  <div style={{ height: '100%', width: `${m.score}%`, background: '#c9a96e', borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Competition results preview */}
          <div style={{
            marginTop: 16, background: '#1c3050', border: '1px solid rgba(201,169,110,0.12)',
            borderRadius: 4, padding: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#c9a96e', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
              Competition results — Sarah K.
            </div>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Event', 'Level', 'Segment', 'Place'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '3px 6px', color: 'rgba(253,252,248,0.35)', fontWeight: 600, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['2024 Nationals', 'Junior', 'FS', '4th'],
                  ['2024 Sectionals', 'Junior', 'SP', '2nd'],
                  ['2023 Regionals', 'Junior', 'FS', '1st'],
                ].map(([evt, lvl, seg, place], i) => (
                  <tr key={i}>
                    <td style={{ padding: '5px 6px', color: '#fdfcf8', borderTop: '1px solid rgba(201,169,110,0.06)' }}>{evt}</td>
                    <td style={{ padding: '5px 6px', color: 'rgba(253,252,248,0.5)', borderTop: '1px solid rgba(201,169,110,0.06)' }}>{lvl}</td>
                    <td style={{ padding: '5px 6px', color: 'rgba(253,252,248,0.5)', borderTop: '1px solid rgba(201,169,110,0.06)' }}>{seg}</td>
                    <td style={{ padding: '5px 6px', color: '#c9a96e', fontWeight: 700, borderTop: '1px solid rgba(201,169,110,0.06)' }}>{place}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Second CTA
// ---------------------------------------------------------------------------
function SecondCTA() {
  return (
    <section className="landing-section" style={{ padding: '0 40px 80px' }}>
      <div style={{
        maxWidth: 480,
        background: '#142236', border: '1px solid rgba(201,169,110,0.15)',
        borderRadius: 4, padding: '40px 36px',
      }}>
        <h2 style={{
          fontSize: '1.5rem', fontWeight: 300, color: '#fdfcf8', marginBottom: 12,
        }}>
          Ready to find your partner?
        </h2>
        <p style={{
          fontSize: '0.85rem', color: 'rgba(253,252,248,0.65)', lineHeight: 1.7, marginBottom: 28,
        }}>
          Submit your info and I'll send you your matches personally within 48 hours.
        </p>
        <Link
          to="/signup"
          style={{
            display: 'inline-block',
            background: '#c9a96e', color: '#0d1b2e', border: 'none',
            padding: '13px 36px', borderRadius: 2, fontWeight: 700,
            fontSize: '0.82rem', textDecoration: 'none',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          Get me matched
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Landing() {
  return (
    <main style={{ background: '#0d1b2e' }}>
      <Hero />
      <WhyUs />
      <ProductDemo />
      <SecondCTA />
    </main>
  );
}
