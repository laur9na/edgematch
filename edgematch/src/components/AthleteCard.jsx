/**
 * AthleteCard.jsx: dark luxury design system
 * Full name shown. Clicking card navigates to /matches/[id].
 */

const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };
const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const ROLE_LABEL = {
  lady: 'Skates as lady', man: 'Skates as man',
};
const JUMP_LABEL = {
  clockwise: 'CW', counter_clockwise: 'CCW',
};

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

function heightStr(cm) {
  if (!cm) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return `${ft}'${inches}"`;
}

function ScoreBar({ score }) {
  const pct = Math.round(score * 100);
  const fillColor = score >= 0.80 ? '#4ade80' : score >= 0.60 ? '#c9a96e' : '#f87171';
  const textColor = fillColor;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(201,169,110,0.15)', borderRadius: 2 }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${pct}%`, background: fillColor,
          }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, minWidth: 32, textAlign: 'right', color: textColor }}>
          {pct}% match
        </span>
      </div>
    </div>
  );
}

function dots(score) {
  const filled = Math.round((score ?? 0) * 5);
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{
      width: 5, height: 5, borderRadius: '50%',
      background: i < filled ? '#c9a96e' : 'rgba(201,169,110,0.2)',
      display: 'inline-block',
    }} />
  ));
}

export default function AthleteCard({ match, index, onClick }) {
  const p = match.partner;
  const score = match.total_score;

  if (score < 0.40) return null;

  const avatarStyle = AVATAR_COLORS[(index ?? 0) % AVATAR_COLORS.length];
  const initials = getInitials(p.name);
  const loc = [p.location_city, p.location_state].filter(Boolean).join(', ');
  const ht = heightStr(p.height_cm);

  return (
    <div
      onClick={onClick}
      style={{
        background: '#142236',
        border: '1px solid rgba(201,169,110,0.12)',
        borderRadius: 4, padding: 20,
        cursor: 'pointer',
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
      {/* Top row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        {p.profile_photo_url ? (
          <img
            src={p.profile_photo_url}
            alt=""
            loading="lazy"
            style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: avatarStyle.bg, color: avatarStyle.color,
            fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initials}
          </div>
        )}

        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fdfcf8', lineHeight: 1.3, wordBreak: 'break-word', marginBottom: 3 }}>
            {p.name}
            {p.skating_level && (
              <span style={{
                display: 'block', marginTop: 3,
                background: 'rgba(201,169,110,0.15)', color: '#c9a96e',
                fontSize: '0.65rem', fontWeight: 600,
                padding: '2px 7px', borderRadius: 2, width: 'fit-content',
                letterSpacing: '0.06em',
              }}>
                {LEVEL_LABEL[p.skating_level] ?? p.skating_level}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(253,252,248,0.65)' }}>
            {[
              DISCIPLINE_LABEL[p.discipline] ?? p.discipline,
              ROLE_LABEL[p.partner_role] ?? p.partner_role,
            ].filter(Boolean).join(' · ')}
          </div>
          {p.jump_direction && p.jump_direction !== 'not_applicable' && (
            <span style={{
              display: 'inline-block', marginTop: 4,
              fontSize: '0.62rem', fontWeight: 700,
              padding: '2px 7px', borderRadius: 2,
              background: 'rgba(201,169,110,0.1)',
              border: '1px solid rgba(201,169,110,0.2)',
              color: '#c9a96e', letterSpacing: '0.06em',
            }}>
              {JUMP_LABEL[p.jump_direction] ?? p.jump_direction}
            </span>
          )}
        </div>
      </div>

      {/* Score bar */}
      <ScoreBar score={score} />

      {/* Sub-score dots */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'nowrap' }}>
        <span style={{ fontSize: '0.68rem', color: 'rgba(253,252,248,0.5)', display: 'flex', alignItems: 'center', gap: 3 }}>
          Height {dots(match.height_score)}
        </span>
        <span style={{ fontSize: '0.68rem', color: 'rgba(253,252,248,0.5)', display: 'flex', alignItems: 'center', gap: 3 }}>
          Level {dots(match.level_score)}
        </span>
        <span style={{ fontSize: '0.68rem', color: 'rgba(253,252,248,0.5)', display: 'flex', alignItems: 'center', gap: 3 }}>
          Distance {dots(match.location_score)}
        </span>
      </div>
    </div>
  );
}
