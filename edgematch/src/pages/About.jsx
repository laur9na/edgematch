/**
 * About.jsx, Phase 7.6
 * Two sections: builder story + matching signals.
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
    desc: 'Lady, man, or open to either. Only compatible roles are shown.',
  },
  {
    n: 4,
    title: 'Distance',
    desc: 'We factor in how far each skater is willing to travel.',
  },
];

export default function About() {
  return (
    <main style={{ background: '#f4f7fb', padding: '32px 28px', maxWidth: 640 }}>

      {/* Section 1 */}
      <h2 style={{
        fontSize: 20, fontWeight: 800, color: '#0f2a5e',
        marginBottom: 12, letterSpacing: '-0.3px',
      }}>
        Built by a skater, for skaters.
      </h2>
      <p style={{
        fontSize: 14, color: '#4a5a7a', lineHeight: 1.65, marginBottom: 32,
      }}>
        I&apos;m Laurena, a 3x National Solo Dance competitor. I&apos;ve watched skaters
        lose seasons because they couldn&apos;t find the right partner. The search runs
        on Facebook posts, coaching favors, and luck. EdgeMatch is the system that
        should have existed.
      </p>

      {/* Section 2 */}
      <h2 style={{
        fontSize: 20, fontWeight: 800, color: '#0f2a5e',
        marginBottom: 16, letterSpacing: '-0.3px',
      }}>
        How we find your match
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SIGNALS.map(s => (
          <div key={s.n} style={{
            background: '#fff', border: '1px solid #d4e0f5', borderRadius: 10,
            padding: '12px 14px', display: 'flex', gap: 10,
          }}>
            <div style={{
              width: 20, height: 20, background: '#1a56db', color: '#fff',
              borderRadius: '50%', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {s.n}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f2a5e', marginBottom: 3 }}>
                {s.title}
              </div>
              <div style={{ fontSize: 11, color: '#5a6a8a', lineHeight: 1.5 }}>
                {s.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
