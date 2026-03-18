/**
 * AthleteCard.jsx, Phase 8.2
 * Full name shown. No try-out button. Clicking card navigates to /matches/[id].
 */

const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };
const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const ROLE_LABEL = {
  lady: 'Skates as lady', man: 'Skates as man', either: 'Either role',
};

const AVATAR_COLORS = [
  { bg: '#dce8fc', color: '#1a56db' },
  { bg: '#fce8dc', color: '#d85a30' },
  { bg: '#e1f5ee', color: '#0f6e56' },
  { bg: '#eeedfe', color: '#534ab7' },
];

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
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
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
  const isGreen  = score >= 0.80;
  const isYellow = score >= 0.60;
  const fillColor = isGreen ? '#27a845' : isYellow ? '#f0b429' : '#e8590c';
  const textColor = isGreen ? '#1a7a3a' : isYellow ? '#8a6a00' : '#9a3a00';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: '#e8eef7', borderRadius: 3 }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${pct}%`, background: fillColor,
          }} />
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, minWidth: 36,
          textAlign: 'right', color: textColor,
        }}>
          {pct}%
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#5a6a8a', marginBottom: 8 }}>
        match strength
      </div>
    </div>
  );
}

function dots(score) {
  const filled = Math.round((score ?? 0) * 5);
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{
      width: 6, height: 6, borderRadius: '50%',
      background: i < filled ? '#1a56db' : '#d4e0f5',
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
        background: '#fff',
        border: '1px solid #d4e0f5',
        borderRadius: 14, padding: 18,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#7aaaf0';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(26,86,219,0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#d4e0f5';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        {p.profile_photo_url ? (
          <img
            src={p.profile_photo_url}
            alt=""
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2a5e', lineHeight: 1.3, wordBreak: 'break-word', marginBottom: 2 }}>
            {p.name}
            {p.skating_level && (
              <span style={{
                display: 'block', marginTop: 3,
                background: '#e8f0fe', color: '#1a56db', fontSize: 10, fontWeight: 600,
                padding: '2px 7px', borderRadius: 4, width: 'fit-content',
              }}>
                {LEVEL_LABEL[p.skating_level] ?? p.skating_level}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#7a8aaa' }}>
            {[
              DISCIPLINE_LABEL[p.discipline] ?? p.discipline,
              ROLE_LABEL[p.partner_role] ?? p.partner_role,
            ].filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontSize: 12, color: '#7a8aaa' }}>
            {[loc, ht].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {/* Score bar */}
      <ScoreBar score={score} />

      {/* Sub-score dots */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'nowrap' }}>
        <span style={{ fontSize: 10, color: '#7a8aaa', display: 'flex', alignItems: 'center', gap: 3 }}>
          Height {dots(match.height_score)}
        </span>
        <span style={{ fontSize: 10, color: '#7a8aaa', display: 'flex', alignItems: 'center', gap: 3 }}>
          Level {dots(match.level_score)}
        </span>
        <span style={{ fontSize: 10, color: '#7a8aaa', display: 'flex', alignItems: 'center', gap: 3 }}>
          Distance {dots(match.location_score)}
        </span>
      </div>
    </div>
  );
}
