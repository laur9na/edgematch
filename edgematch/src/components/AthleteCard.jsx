import CompatibilityBar from './CompatibilityBar';

const LEVEL_LABELS = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};

const ROLE_LABELS = { lady: 'Lady', man: 'Man', either: 'Either' };

function locationStr(p) {
  return [p.location_city, p.location_state, p.location_country]
    .filter(Boolean).join(', ') || 'Location unknown';
}

function heightStr(cm) {
  if (!cm) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return `${ft}'${inches}" (${cm} cm)`;
}

export default function AthleteCard({ match, onRequestTryout }) {
  const p = match.partner;
  const score = match.total_score;

  return (
    <div className="athlete-card">
      <div className="card-header">
        <div className="card-name-row">
          <span className="card-name">{p.name}</span>
          {p.verified && <span className="badge-verified">✓ Verified</span>}
        </div>
        <CompatibilityBar score={score} />
      </div>

      <div className="card-details">
        <div className="card-detail-row">
          <span>{LEVEL_LABELS[p.skating_level] ?? p.skating_level}</span>
          <span>·</span>
          <span>{ROLE_LABELS[p.partner_role] ?? p.partner_role}</span>
          {p.age && <><span>·</span><span>Age {p.age}</span></>}
        </div>
        <div className="card-detail-row muted">
          {p.height_cm && <span>{heightStr(p.height_cm)}</span>}
          {p.height_cm && <span>·</span>}
          <span>{locationStr(p)}</span>
        </div>
        {p.club_name && (
          <div className="card-detail-row muted">
            <span>{p.club_name}</span>
            {p.coach_name && <><span>·</span><span>Coach: {p.coach_name}</span></>}
          </div>
        )}
      </div>

      <div className="card-scores">
        <ScorePill label="Height" value={match.height_score} />
        <ScorePill label="Level"  value={match.level_score} />
        <ScorePill label="Role"   value={match.role_score} />
      </div>

      <div className="card-footer">
        <button className="btn-tryout" onClick={() => onRequestTryout(match)}>
          Request tryout
        </button>
      </div>
    </div>
  );
}

function ScorePill({ label, value }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8 ? 'green' : value >= 0.6 ? 'yellow' : value >= 0.4 ? 'orange' : 'red';
  return (
    <span className={`score-pill score-pill--${color}`}>
      {label} {pct}%
    </span>
  );
}
