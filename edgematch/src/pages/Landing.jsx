/**
 * Landing.jsx
 * Public landing page for edgematch.co.
 * Sections: Hero, Why Us, Product Screenshot, Second CTA.
 * Dark luxury design: navy, gold, Nunito.
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
        and ice dance partners. Tell me what you're looking for. I'll find your matches personally.
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
    body: 'IcePartnerSearch shows you a list. EdgeMatch scores compatibility by level, height ratio, role, jump direction, and location, then I personally review your matches before sending them.',
  },
  {
    title: 'Competition data built in',
    body: "Your matches come with their actual competition history: events, placements, levels. No guessing whether someone is actually at your level.",
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
function BrowserChrome({ url, children }) {
  return (
    <div style={{
      background: '#142236', border: '1px solid rgba(201,169,110,0.15)',
      borderRadius: 6, overflow: 'hidden',
      boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
    }}>
      <div style={{ background: '#1a3a6b', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(253,252,248,0.15)' }} />
        ))}
        <div style={{
          flex: 1, marginLeft: 6, background: 'rgba(253,252,248,0.06)',
          borderRadius: 2, height: 18, maxWidth: 220,
          display: 'flex', alignItems: 'center', padding: '0 8px',
        }}>
          <span style={{ fontSize: 9, color: 'rgba(253,252,248,0.3)' }}>{url}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function ProductDemo() {
  const matches = [
    { initials: 'SK', color: '#c9a96e', bg: 'rgba(201,169,110,0.15)', name: 'Sarah K.', level: 'Junior', disc: 'Pairs', score: 94, info: "5'4\" · Detroit SC" },
    { initials: 'MR', color: '#a5b4fc', bg: 'rgba(99,102,241,0.15)',  name: 'Maya R.',  level: 'Senior', disc: 'Ice dance', score: 88, info: "5'3\" · Chicago FSC" },
    { initials: 'EP', color: '#4ade80', bg: 'rgba(22,163,74,0.15)',   name: 'Emma P.',  level: 'Junior', disc: 'Pairs',     score: 81, info: "5'5\" · Twin Rinks" },
    { initials: 'AL', color: '#f87171', bg: 'rgba(239,68,68,0.15)',   name: 'Ava L.',   level: 'Novice', disc: 'Pairs',     score: 76, info: "5'3\" · Skating Club of Boston" },
  ];

  return (
    <section className="landing-section" style={{ padding: '0 40px 72px', maxWidth: 1080 }}>
      <div style={{
        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em',
        color: '#c9a96e', textTransform: 'uppercase', marginBottom: 20,
      }}>
        The product
      </div>
      <p style={{
        fontSize: '0.9rem', color: 'rgba(253,252,248,0.65)', marginBottom: 28, lineHeight: 1.6,
      }}>
        Your matches, their full profile, their competition history, all in one place.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Left: skater profile */}
        <BrowserChrome url="app.edgematch.co/athletes/sarah-k">
          <div style={{ padding: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(201,169,110,0.15)', color: '#c9a96e',
                fontSize: 16, fontWeight: 700, border: '1px solid rgba(201,169,110,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>SK</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 300, color: '#fdfcf8', marginBottom: 3 }}>Sarah K.</div>
                <div style={{ fontSize: 10, color: 'rgba(253,252,248,0.5)' }}>Pairs · Skates as lady · Junior</div>
              </div>
              <div style={{
                background: 'rgba(201,169,110,0.12)', color: '#c9a96e',
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 2,
              }}>94% match</div>
            </div>

            {/* Score bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 3, background: 'rgba(201,169,110,0.12)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: '94%', background: '#4ade80', borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80' }}>94%</span>
              </div>
            </div>

            {/* Metrics */}
            <div style={{ fontSize: 11, color: 'rgba(253,252,248,0.45)', marginBottom: 16, lineHeight: 1.7 }}>
              5'4" · Trains 20 hrs/week · Coach: Mark Ladwig · Based in Detroit, MI
            </div>

            {/* Club */}
            <div style={{
              background: '#1c3050', border: '1px solid rgba(201,169,110,0.1)',
              borderRadius: 3, padding: '10px 12px', marginBottom: 14,
            }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#c9a96e', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Club</div>
              <div style={{ fontSize: 11, color: '#fdfcf8' }}>Detroit Skating Club</div>
              <div style={{ fontSize: 10, color: 'rgba(253,252,248,0.4)', marginTop: 2 }}>Detroit, MI</div>
            </div>

            {/* Competition results */}
            <div style={{
              background: '#1c3050', border: '1px solid rgba(201,169,110,0.1)',
              borderRadius: 3, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#c9a96e', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                Competition results
              </div>
              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Event', 'Level', 'Seg', 'Place'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '2px 5px', color: 'rgba(253,252,248,0.35)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['2024 Nationals', 'Junior', 'FS', '4th'],
                    ['2024 Sectionals', 'Junior', 'SP', '2nd'],
                    ['2023 Nationals', 'Junior', 'FS', '6th'],
                    ['2023 Regionals', 'Novice', 'FS', '1st'],
                  ].map(([evt, lvl, seg, place], i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 5px', color: '#fdfcf8', borderTop: '1px solid rgba(201,169,110,0.06)' }}>{evt}</td>
                      <td style={{ padding: '4px 5px', color: 'rgba(253,252,248,0.45)', borderTop: '1px solid rgba(201,169,110,0.06)' }}>{lvl}</td>
                      <td style={{ padding: '4px 5px', color: 'rgba(253,252,248,0.45)', borderTop: '1px solid rgba(201,169,110,0.06)' }}>{seg}</td>
                      <td style={{ padding: '4px 5px', color: '#c9a96e', fontWeight: 700, borderTop: '1px solid rgba(201,169,110,0.06)' }}>{place}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </BrowserChrome>

        {/* Right: matches grid */}
        <BrowserChrome url="app.edgematch.co/matches">
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#c9a96e', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>
              Your matches
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {matches.map((m, i) => (
                <div key={i} style={{
                  background: '#1c3050', border: '1px solid rgba(201,169,110,0.12)',
                  borderRadius: 4, padding: 13,
                }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: m.bg, color: m.color,
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{m.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#fdfcf8', marginBottom: 1 }}>{m.name}</div>
                      <div style={{ fontSize: 9, color: 'rgba(253,252,248,0.45)' }}>{m.disc} · {m.level}</div>
                    </div>
                    <div style={{
                      background: 'rgba(201,169,110,0.12)', color: '#c9a96e',
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 2, flexShrink: 0,
                    }}>{m.score}%</div>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(253,252,248,0.4)', marginBottom: 6 }}>{m.info}</div>
                  <div style={{ height: 3, background: 'rgba(201,169,110,0.12)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${m.score}%`, background: '#c9a96e', borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </BrowserChrome>

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
