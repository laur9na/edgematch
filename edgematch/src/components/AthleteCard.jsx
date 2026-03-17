/**
 * AthleteCard.jsx — Phase 7.3
 * Exact spec layout: avatar, name+level badge, score bar, sub-score dots, request button.
 */
import { useState } from 'react';

const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };
const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const ROLE_LABEL = {
  lady: 'Skates as lady', man: 'Skates as man', either: 'Either role',
};

// Avatar color palette — rotate by index
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
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
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

function DotIndicator({ label, value }) {
  const filled = Math.round((value ?? 0) * 5);
  return (
    <div style={{ fontSize: 11, color: '#7a8aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ marginRight: 2 }}>{label}</span>
      {[0,1,2,3,4].map(i => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
            background: i < filled ? '#1a56db' : '#d4e0f5',
          }}
        />
      ))}
    </div>
  );
}

export default function AthleteCard({ match, onRequestTryout, index }) {
  const p = match.partner;
  const score = match.total_score;
  const [hovered, setHovered] = useState(false);

  if (score < 0.40) return null;

  const avatarStyle = AVATAR_COLORS[(index ?? 0) % AVATAR_COLORS.length];
  const initials = getInitials(p.name);
  const displayName = lastInitial(p.name);
  const loc = [p.location_city, p.location_state].filter(Boolean).join(', ');
  const ht = heightStr(p.height_cm);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hovered ? '#7aaaf0' : '#d4e0f5'}`,
        borderRadius: 14, padding: 18,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? '0 2px 12px rgba(26,86,219,0.08)' : 'none',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: avatarStyle.bg, color: avatarStyle.color,
          fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initials}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f2a5e' }}>
              {displayName}
            </span>
            {p.skating_level && (
              <span style={{
                background: '#e8f0fe', color: '#1a56db', fontSize: 10, fontWeight: 600,
                padding: '2px 7px', borderRadius: 4, marginLeft: 6,
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
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <DotIndicator label="Height"   value={match.height_score} />
        <DotIndicator label="Level"    value={match.level_score} />
        <DotIndicator label="Distance" value={match.location_score} />
      </div>

      {/* Request button */}
      <button
        style={{
          width: '100%', background: '#1a56db', color: '#fff', border: 'none',
          padding: 9, borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={() => onRequestTryout(match)}
      >
        Request try-out
      </button>
    </div>
  );
}
