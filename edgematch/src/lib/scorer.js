/**
 * scorer.js: compatibility scoring for pairs and ice dance athletes.
 *
 * computeScore(a, b) → { height, level, role, location, goals, total } (all 0–1)
 *   or null if the pair is discipline-incompatible or role-incompatible.
 *
 * Weights:  height 35% · level 30% · role 20% · location 10% · goals 5%
 */

export const SCORE_VERSION = 3;

const LEVEL_ORDER = [
  'pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult',
];

function levelIndex(l) {
  const i = LEVEL_ORDER.indexOf(l);
  return i === -1 ? 3 : i; // default to mid-range if unknown
}

// Are two partner_roles compatible?
function rolesCompatible(ra, rb) {
  if (!ra || !rb) return true; // unknown; allow
  return ra !== rb; // one must be lady, other man
}

// Height score: ideal delta differs by discipline
// Pairs: man should be 10–25 cm taller than lady (ideal 15 cm delta)
// Ice dance: man should be 3–15 cm taller (ideal 8 cm delta)
function heightScore(a, b, discipline) {
  const hA = a.height_cm, hB = b.height_cm;
  if (!hA || !hB) return 0.5; // unknown height; neutral

  // Determine who is "man" and who is "lady"
  const aIsMan = a.partner_role === 'man' || (a.partner_role !== 'lady' && hA >= hB);
  const manH   = aIsMan ? hA : hB;
  const ladyH  = aIsMan ? hB : hA;
  const delta  = manH - ladyH;

  if (discipline === 'pairs') {
    // Ideal: 10–20 cm, optimal 15 cm
    if (delta < 0)  return Math.max(0, 1 + delta / 15);       // penalty for man shorter
    if (delta <= 20) return 1 - Math.abs(delta - 15) / 20;    // optimal zone
    return Math.max(0, 1 - (delta - 20) / 25);                // too tall
  } else {
    // Ice dance: ideal 5–12 cm, optimal 8 cm
    if (delta < 0)  return Math.max(0, 1 + delta / 10);
    if (delta <= 12) return 1 - Math.abs(delta - 8) / 16;
    return Math.max(0, 1 - (delta - 12) / 20);
  }
}

// Level score: 1 for same level, falls off with distance
function levelScore(a, b) {
  const ia = levelIndex(a.skating_level);
  const ib = levelIndex(b.skating_level);
  const diff = Math.abs(ia - ib);
  if (diff === 0) return 1;
  if (diff === 1) return 0.75;
  if (diff === 2) return 0.45;
  return Math.max(0, 0.3 - (diff - 3) * 0.1);
}

// Role score: complementary man+lady = 1, unknown = 0.9
function roleScore(a, b) {
  if (!rolesCompatible(a.partner_role, b.partner_role)) return 0;
  return 1;
}

// Location score: based on lat/lng distance and willingness
function locationScore(a, b) {
  const lat1 = a.location_lat, lon1 = a.location_lng;
  const lat2 = b.location_lat, lon2 = b.location_lng;

  if (!lat1 || !lon1 || !lat2 || !lon2) return 0.5; // unknown; neutral

  // Haversine distance in km
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(
    sinLat * sinLat +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * sinLon * sinLon
  ));
  const distKm = R * c;

  // Max distance = min of both athletes' stated willingness (default 1000 km)
  const maxDist = Math.min(a.max_distance_km ?? 1000, b.max_distance_km ?? 1000);

  if (distKm === 0) return 1;
  if (distKm > maxDist * 1.5) return 0;
  return Math.max(0, 1 - distKm / (maxDist * 1.5));
}

// Goals score: keyword overlap between free-text goals fields
function goalsScore(a, b) {
  const ga = (a.goals ?? '').toLowerCase();
  const gb = (b.goals ?? '').toLowerCase();
  if (!ga || !gb) return 0.5;

  const keywords = ['nationals', 'juniors', 'seniors', 'compete', 'elite', 'recreational',
    'fun', 'serious', 'compete', 'olympics', 'worlds', 'sectionals', 'regionals'];
  const aKw = new Set(keywords.filter(k => ga.includes(k)));
  const bKw = new Set(keywords.filter(k => gb.includes(k)));
  if (!aKw.size || !bKw.size) return 0.5;

  const intersection = [...aKw].filter(k => bKw.has(k)).length;
  const union = new Set([...aKw, ...bKw]).size;
  return intersection / union;
}

/**
 * computeScore(a, b) → { height, level, role, location, goals, total } or null
 * Returns null when the pair is fundamentally incompatible (different discipline or roles clash).
 */
export function computeScore(a, b) {
  // Must be same discipline
  if (a.discipline !== b.discipline) return null;

  // Roles must be compatible
  if (!rolesCompatible(a.partner_role, b.partner_role)) return null;

  const height   = Math.round(heightScore(a, b, a.discipline) * 100) / 100;
  const level    = Math.round(levelScore(a, b) * 100) / 100;
  const role     = Math.round(roleScore(a, b) * 100) / 100;
  const location = Math.round(locationScore(a, b) * 100) / 100;
  const goals    = Math.round(goalsScore(a, b) * 100) / 100;

  // Weighted total
  const total = Math.round(
    (height * 0.35 + level * 0.30 + role * 0.20 + location * 0.10 + goals * 0.05) * 100
  ) / 100;

  return { height, level, role, location, goals, total };
}
