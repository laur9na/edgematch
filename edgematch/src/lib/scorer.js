/**
 * src/lib/scorer.js Compatibility scoring algorithm, Phase 0, v1)
 *
 * All component scores return 0.0–1.0.
 * Final score = weighted sum of components.
 * Pure JS no DB dependency.
 */

export const WEIGHTS = {
  height:   0.35,
  level:    0.30,
  role:     0.15,
  location: 0.15,
  goals:    0.05,  // placeholder embeddings added in Phase 2
};

export const SCORE_VERSION = 1;

// ---------------------------------------------------------------------------
// Component scorers
// ---------------------------------------------------------------------------

/**
 * Height compatibility.
 * Pairs: ideal man 15-25cm taller than lady.
 * Ice dance: ideal man 8-18cm taller.
 */
export function heightScore(a, b, discipline) {
  if (a.height_cm == null || b.height_cm == null) return 0.5;
  const delta = Math.abs(a.height_cm - b.height_cm);

  if (discipline === 'pairs') {
    if (delta >= 15 && delta <= 25) return 1.0;
    if (delta < 15) return Math.max(0, 1 - (15 - delta) / 15);
    return Math.max(0, 1 - (delta - 25) / 20);
  }
  if (discipline === 'ice_dance') {
    if (delta >= 8 && delta <= 18) return 1.0;
    if (delta < 8)  return Math.max(0, 1 - (8 - delta) / 10);
    return Math.max(0, 1 - (delta - 18) / 15);
  }
  return 0.5;
}

/**
 * Skating level alignment.
 * Same level = 1.0, 1 apart = 0.7, 2 = 0.4, 3 = 0.15, 4+ = 0.
 */
const LEVEL_ORDER = ['pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult'];
const LEVEL_SCORES = [1.0, 0.7, 0.4, 0.15, 0.0];

export function levelScore(a, b) {
  const ia = LEVEL_ORDER.indexOf(a.skating_level);
  const ib = LEVEL_ORDER.indexOf(b.skating_level);
  if (ia < 0 || ib < 0) return 0.5;
  const delta = Math.abs(ia - ib);
  return LEVEL_SCORES[Math.min(delta, LEVEL_SCORES.length - 1)];
}

/**
 * Role compatibility.
 * lady+man = ideal; either combinations penalised slightly.
 * lady+lady or man+man = 0 (can't form a pair).
 */
export function roleScore(a, b) {
  const roles = [a.partner_role, b.partner_role].sort().join('-');
  const map = {
    'lady-man':      1.0,
    'either-man':    0.9,
    'either-lady':   0.9,
    'either-either': 0.7,
    'lady-lady':     0.0,
    'man-man':       0.0,
  };
  return map[roles] ?? 0.5;
}

/**
 * Location score via haversine distance.
 * 0 km = 1.0, 500 km = 0.5, 2000+ km = 0.1 (still shown may relocate).
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function locationScore(a, b) {
  if (!a.location_lat || !b.location_lat) return 0.5;
  const dist = haversineKm(a.location_lat, a.location_lng, b.location_lat, b.location_lng);
  const willing = Math.min(a.max_distance_km ?? 500, b.max_distance_km ?? 500);
  if (dist <= willing) return Math.max(0.5, 1 - dist / (willing * 2));
  return Math.max(0.1, 0.5 - (dist - willing) / 2000);
}

// ---------------------------------------------------------------------------
// Composite score
// ---------------------------------------------------------------------------

/**
 * Compute compatibility between two athletes.
 * Returns null if they can't be matched (different discipline, or either inactive).
 * Returns { height, level, role, location, goals, total } otherwise.
 */
export function computeScore(a, b) {
  if (a.discipline !== b.discipline) return null;
  if ((a.search_status ?? 'active') !== 'active') return null;
  if ((b.search_status ?? 'active') !== 'active') return null;

  const scores = {
    height:   heightScore(a, b, a.discipline),
    level:    levelScore(a, b),
    role:     roleScore(a, b),
    location: locationScore(a, b),
    goals:    0.5,  // phase 2 placeholder
  };

  const total = Object.entries(WEIGHTS).reduce(
    (sum, [k, w]) => sum + scores[k] * w,
    0
  );

  return { ...scores, total: Math.round(total * 1000) / 1000 };
}
