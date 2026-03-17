/**
 * CompatibilityBar — horizontal score bar with color coding.
 * green ≥ 0.8 · yellow ≥ 0.6 · orange ≥ 0.4 · red < 0.4
 */
export default function CompatibilityBar({ score, showLabel = true }) {
  const pct = Math.round(score * 100);

  const color =
    score >= 0.8 ? '#16a34a' :
    score >= 0.6 ? '#ca8a04' :
    score >= 0.4 ? '#ea580c' :
                   '#dc2626';

  return (
    <div className="compat-bar-wrap">
      <div className="compat-bar-track">
        <div
          className="compat-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span className="compat-bar-label" style={{ color }}>
          {pct}%
        </span>
      )}
    </div>
  );
}
