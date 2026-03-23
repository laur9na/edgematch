/**
 * About.jsx
 * Builder story + matching signals. Dark luxury design system.
 */

const SIGNALS = [
  {
    n: 1,
    title: 'Height compatibility',
    desc: 'Height ratio directly affects lifts and timing. We score based on the ideal delta for your discipline.',
  },
  {
    n: 2,
    title: 'Skill level',
    desc: 'Partners at the same level train and compete most effectively.',
  },
  {
    n: 3,
    title: 'Role fit',
    desc: 'Lady or man. Only compatible roles are shown.',
  },
  {
    n: 4,
    title: 'Distance',
    desc: 'We factor in how far each skater is willing to travel.',
  },
];

export default function About() {
  return (
    <main style={{ background: '#0d1b2e', padding: '48px 40px', maxWidth: 680 }}>

      <div style={{
        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em',
        color: '#c9a96e', textTransform: 'uppercase', marginBottom: 20,
      }}>
        About EdgeMatch
      </div>

      <h2 style={{
        fontSize: '1.8rem', fontWeight: 300, color: '#fdfcf8',
        marginBottom: 16, letterSpacing: '-0.01em',
      }}>
        Built by a skater, for skaters.
      </h2>
      <p style={{
        fontSize: '0.88rem', color: 'rgba(253,252,248,0.65)', lineHeight: 1.75, marginBottom: 48,
      }}>
        I&apos;m Laurena, a 3x National Solo Dance competitor. I&apos;ve watched skaters
        lose seasons because they couldn&apos;t find the right partner. The search runs
        on Facebook posts, coaching favors, and luck. EdgeMatch is the system that
        should have existed.
      </p>

      <div style={{
        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em',
        color: '#c9a96e', textTransform: 'uppercase', marginBottom: 20,
      }}>
        How we find your match
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SIGNALS.map(s => (
          <div key={s.n} style={{
            background: '#142236', border: '1px solid rgba(201,169,110,0.12)',
            borderRadius: 4, padding: '16px 18px', display: 'flex', gap: 14,
            transition: 'border-color 250ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.12)'; }}
          >
            <div style={{
              width: 22, height: 22, background: '#c9a96e', color: '#0d1b2e',
              borderRadius: '50%', fontSize: '0.72rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>
              {s.n}
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fdfcf8', marginBottom: 4 }}>
                {s.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(253,252,248,0.65)', lineHeight: 1.6 }}>
                {s.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
