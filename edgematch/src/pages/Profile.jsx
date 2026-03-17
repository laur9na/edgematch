/**
 * Profile.jsx, Phase 7.4
 * Default view: Instagram-style profile card (header, media grid, about, competition results).
 * Edit mode: same multi-step form with completeness bar.
 * New athletes (no athlete row): creation wizard only.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };
const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const ROLE_LABEL = {
  lady: 'Skates as lady', man: 'Skates as man', either: 'Either role',
};
const DISCIPLINES = [
  { value: 'pairs',     label: 'Pairs' },
  { value: 'ice_dance', label: 'Ice dance' },
];
const ROLES = [
  { value: 'lady',   label: 'Lady' },
  { value: 'man',    label: 'Man' },
  { value: 'either', label: 'Either / Flexible' },
];
const LEVELS = [
  { value: 'pre_juvenile', label: 'Pre-Juvenile' },
  { value: 'juvenile',     label: 'Juvenile' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'novice',       label: 'Novice' },
  { value: 'junior',       label: 'Junior' },
  { value: 'senior',       label: 'Senior' },
  { value: 'adult',        label: 'Adult' },
];

function ftInToCm(ft, inches) {
  return Math.round((parseInt(ft || 0) * 12 + parseInt(inches || 0)) * 2.54);
}
function cmToFtIn(cm) {
  const totalIn = (cm || 0) / 2.54;
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) };
}

// ---------------------------------------------------------------------------
// Profile completeness
// ---------------------------------------------------------------------------
const KEY_FIELDS     = ['name', 'discipline', 'partner_role', 'height_cm', 'skating_level', 'location_city'];
const OPTIONAL_FIELDS = ['age', 'goals', 'training_hours_wk', 'coach_name', 'club_name', 'instagram_handle'];

function completeness(athlete) {
  if (!athlete) return { pct: 0, missing: null };
  const all    = [...KEY_FIELDS, ...OPTIONAL_FIELDS];
  const filled = all.filter(f => athlete[f] && athlete[f] !== 0);
  const pct    = Math.round((filled.length / all.length) * 100);
  const missing = all.find(f => !athlete[f] || athlete[f] === 0);
  return { pct, missing: missing ? missing.replace(/_/g, ' ') : null };
}

// ---------------------------------------------------------------------------
// Avatar helpers
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
function Toast({ msg, onHide }) {
  useEffect(() => {
    const t = setTimeout(onHide, 2500);
    return () => clearTimeout(t);
  }, [onHide]);
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#1a3a6b', color: '#fff', padding: '10px 20px',
      borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 200,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    }}>
      {msg}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competition results section
// ---------------------------------------------------------------------------
function CompetitionResults({ athleteId }) {
  const [results, setResults]   = useState([]);
  const [showAll, setShowAll]   = useState(false);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    if (!athleteId) return;
    supabase
      .from('competition_results')
      .select('event_name, event_year, level, segment, placement, total_score')
      .eq('athlete_id', athleteId)
      .order('event_year', { ascending: false })
      .then(({ data }) => {
        setResults(data ?? []);
        setLoaded(true);
      });
  }, [athleteId]);

  if (!loaded || results.length === 0) return null;

  const visible = showAll ? results : results.slice(0, 10);

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.8px', color: '#7a8aaa', marginBottom: 8,
      }}>
        Competition results
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {['Event', 'Level', 'Segment', 'Place', 'Score'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '4px 6px',
                borderBottom: '1px solid #d4e0f5', color: '#7a8aaa', fontWeight: 700,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: '5px 6px', borderBottom: '1px solid #f0f4fb', color: '#0f2a5e' }}>
                {r.event_name}
              </td>
              <td style={{ padding: '5px 6px', borderBottom: '1px solid #f0f4fb', color: '#4a5a7a' }}>
                {LEVEL_LABEL[r.level] ?? r.level}
              </td>
              <td style={{ padding: '5px 6px', borderBottom: '1px solid #f0f4fb', color: '#4a5a7a' }}>
                {r.segment}
              </td>
              <td style={{ padding: '5px 6px', borderBottom: '1px solid #f0f4fb', color: '#4a5a7a', textAlign: 'center' }}>
                {r.placement ?? '-'}
              </td>
              <td style={{ padding: '5px 6px', borderBottom: '1px solid #f0f4fb', color: '#4a5a7a', textAlign: 'right' }}>
                {r.total_score ?? '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length > 10 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            marginTop: 8, background: 'none', border: 'none',
            color: '#1a56db', fontSize: 12, cursor: 'pointer', padding: 0,
          }}
        >
          View all ({results.length})
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile view (default)
// ---------------------------------------------------------------------------
function ProfileView({ athlete, onEdit }) {
  const mediaUrls = athlete.media_urls ?? [];
  const cells     = Array.from({ length: 9 }, (_, i) => mediaUrls[i] ?? null);
  const firstEmpty = cells.findIndex(c => c === null);

  return (
    <div style={{ maxWidth: 480, margin: '24px auto', padding: '0 16px' }}>
      <div style={{
        background: '#fff', border: '1px solid #d4e0f5',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: 20, borderBottom: '1px solid #f0f4fb' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 8 }}>
            {athlete.profile_photo_url ? (
              <img
                src={athlete.profile_photo_url}
                alt=""
                style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: '#dce8fc', color: '#1a56db',
                fontSize: 16, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {getInitials(athlete.name)}
              </div>
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f2a5e' }}>
                {athlete.name}
              </div>
              <div style={{ fontSize: 12, color: '#7a8aaa', marginTop: 2 }}>
                {[
                  LEVEL_LABEL[athlete.skating_level],
                  DISCIPLINE_LABEL[athlete.discipline],
                  ROLE_LABEL[athlete.partner_role],
                ].filter(Boolean).join(' · ')}
              </div>
              {(athlete.location_city || athlete.location_state) && (
                <div style={{ fontSize: 12, color: '#7a8aaa' }}>
                  {[athlete.location_city, athlete.location_state].filter(Boolean).join(', ')}
                </div>
              )}
              {athlete.instagram_handle && (
                <a
                  href={`https://instagram.com/${athlete.instagram_handle}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#1a56db', textDecoration: 'none' }}
                >
                  @{athlete.instagram_handle}
                </a>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={onEdit}
              style={{
                background: '#fff', color: '#1a3a6b',
                border: '1.5px solid #c5d3eb',
                padding: '6px 14px', borderRadius: 7,
                fontSize: 12, cursor: 'pointer',
              }}
            >
              Edit profile
            </button>
            <button
              style={{
                background: '#f0f4fb', color: '#4a5a7a', border: 'none',
                padding: '6px 14px', borderRadius: 7,
                fontSize: 12, cursor: 'pointer',
              }}
            >
              Share
            </button>
          </div>
        </div>

        {/* Media grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2,
        }}>
          {cells.map((url, i) => (
            <div
              key={i}
              style={{
                aspectRatio: '1/1', overflow: 'hidden',
                background: url ? '#b5d4f4' : '#dce8fc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}
            >
              {url ? (
                url.match(/\.(mp4|mov|webm)$/i) ? (
                  <>
                    <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </div>
                  </>
                ) : (
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )
              ) : (
                i === firstEmpty
                  ? <span style={{ fontSize: 10, color: '#7a9ace' }}>+ Add</span>
                  : null
              )}
            </div>
          ))}
        </div>

        {/* About section */}
        <div style={{ padding: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: '#7a8aaa', marginBottom: 8,
          }}>
            ABOUT
          </div>
          {athlete.goals && (
            <div style={{ fontSize: 12, color: '#4a5a7a', marginBottom: 4 }}>{athlete.goals}</div>
          )}
          {athlete.training_hours_wk && (
            <div style={{ fontSize: 12, color: '#4a5a7a', marginBottom: 4 }}>
              Training: {athlete.training_hours_wk} hrs/week
            </div>
          )}
          {athlete.coach_name && (
            <div style={{ fontSize: 12, color: '#4a5a7a', marginBottom: 4 }}>
              Coach: {athlete.coach_name}
            </div>
          )}
          {athlete.club_name && (
            <div style={{ fontSize: 12, color: '#4a5a7a' }}>Club: {athlete.club_name}</div>
          )}
          {!athlete.goals && !athlete.training_hours_wk && !athlete.coach_name && !athlete.club_name && (
            <div style={{ fontSize: 12, color: '#7a8aaa' }}>No details added yet.</div>
          )}
        </div>

        {/* Competition results only renders if athlete has matched results */}
        <CompetitionResults athleteId={athlete.id} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step components (edit form)
// ---------------------------------------------------------------------------
function StepBasics({ data, onChange, isExistingUser }) {
  return (
    <div className="step">
      <h2>Step 1: Basics</h2>
      <label>Full name *
        <input value={data.name} onChange={e => onChange('name', e.target.value)} placeholder="First Last" required />
      </label>
      {!isExistingUser && (
        <>
          <label>Email *
            <input type="email" value={data.email} onChange={e => onChange('email', e.target.value)} placeholder="you@example.com" required />
          </label>
          <label>Password *
            <input type="password" value={data.password} onChange={e => onChange('password', e.target.value)} placeholder="At least 8 characters" minLength={8} required />
          </label>
        </>
      )}
      {isExistingUser && (
        <p className="hint" style={{ marginBottom: 12 }}>Signed in as <strong>{data.email}</strong></p>
      )}
      <label>Age
        <input type="number" value={data.age} onChange={e => onChange('age', e.target.value)} min={8} max={99} placeholder="e.g. 17" />
      </label>
      <label>Discipline *
        <select value={data.discipline} onChange={e => onChange('discipline', e.target.value)} required>
          <option value="">Select...</option>
          {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>
      <label>Your role *
        <select value={data.partner_role} onChange={e => onChange('partner_role', e.target.value)} required>
          <option value="">Select...</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      <label>Instagram
        <input value={data.instagram_handle || ''} onChange={e => onChange('instagram_handle', e.target.value)} placeholder="@username" />
      </label>
    </div>
  );
}

function StepPhysical({ data, onChange }) {
  const [unit, setUnit] = useState('imperial');

  function handleFtIn(field, val) {
    const ft     = field === 'ft'     ? val : (data._ft || 0);
    const inches = field === 'inches' ? val : (data._inches || 0);
    onChange('_ft', ft);
    onChange('_inches', inches);
    onChange('height_cm', ftInToCm(ft, inches));
  }
  function handleCm(val) {
    const cm = parseFloat(val) || 0;
    onChange('height_cm', cm);
    const { ft, inches } = cmToFtIn(cm);
    onChange('_ft', ft);
    onChange('_inches', inches);
  }

  return (
    <div className="step">
      <h2>Step 2: Physical Info</h2>
      <label>Height *
        <div className="unit-toggle">
          <button type="button" className={unit === 'imperial' ? 'active' : ''} onClick={() => setUnit('imperial')}>ft / in</button>
          <button type="button" className={unit === 'metric' ? 'active' : ''} onClick={() => setUnit('metric')}>cm</button>
        </div>
        {unit === 'imperial' ? (
          <div className="inline-inputs">
            <input type="number" value={data._ft || ''} onChange={e => handleFtIn('ft', e.target.value)} min={3} max={7} placeholder="ft" style={{ width: 60 }} />
            <span>&apos;</span>
            <input type="number" value={data._inches || ''} onChange={e => handleFtIn('inches', e.target.value)} min={0} max={11} placeholder="in" style={{ width: 60 }} />
            <span>&quot;</span>
            {data.height_cm > 0 && <span className="hint">= {data.height_cm} cm</span>}
          </div>
        ) : (
          <input type="number" value={data.height_cm || ''} onChange={e => handleCm(e.target.value)} min={100} max={220} placeholder="e.g. 163" />
        )}
      </label>
      <label>Weight <span className="optional">(optional)</span>
        <div className="inline-inputs">
          <input type="number" value={data.weight_kg || ''} onChange={e => onChange('weight_kg', parseFloat(e.target.value) || null)} min={30} max={150} placeholder="kg" />
          <span>kg</span>
        </div>
      </label>
    </div>
  );
}

function StepSkating({ data, onChange }) {
  return (
    <div className="step">
      <h2>Step 3: Skating Background</h2>
      <label>Skating level *
        <select value={data.skating_level} onChange={e => onChange('skating_level', e.target.value)} required>
          <option value="">Select...</option>
          {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>
      <label>Club name
        <input value={data.club_name} onChange={e => onChange('club_name', e.target.value)} placeholder="e.g. Peninsula Skating Club" />
      </label>
      <label>Coach name
        <input value={data.coach_name} onChange={e => onChange('coach_name', e.target.value)} placeholder="e.g. Jane Smith" />
      </label>
      <label>Training hours per week
        <input type="number" value={data.training_hours_wk || ''} onChange={e => onChange('training_hours_wk', parseInt(e.target.value) || null)} min={1} max={60} placeholder="e.g. 15" />
      </label>
    </div>
  );
}

function StepGoals({ data, onChange }) {
  return (
    <div className="step">
      <h2>Step 4: Goals and Preferences</h2>
      <label>What are your skating goals?
        <textarea value={data.goals} onChange={e => onChange('goals', e.target.value)} rows={4} placeholder="e.g. Compete at Junior Nationals by 2027..." />
      </label>
      <label>Preferred partner level range
        <div className="inline-inputs">
          <select value={data.preferred_level_min} onChange={e => onChange('preferred_level_min', e.target.value)}>
            <option value="">No min</option>
            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <span>to</span>
          <select value={data.preferred_level_max} onChange={e => onChange('preferred_level_max', e.target.value)}>
            <option value="">No max</option>
            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </label>
      <label>Maximum travel distance (km)
        <input type="number" value={data.max_distance_km} onChange={e => onChange('max_distance_km', parseInt(e.target.value) || 500)} min={50} max={20000} step={50} placeholder="500" />
        <span className="hint">Use a large number (e.g. 20000) if open to relocating.</span>
      </label>
    </div>
  );
}

function StepLocation({ data, onChange }) {
  return (
    <div className="step">
      <h2>Step 5: Location</h2>
      <label>City
        <input value={data.location_city} onChange={e => onChange('location_city', e.target.value)} placeholder="e.g. San Jose" />
      </label>
      <label>State / Province
        <input value={data.location_state} onChange={e => onChange('location_state', e.target.value)} placeholder="e.g. CA" />
      </label>
      <label>Country
        <input value={data.location_country} onChange={e => onChange('location_country', e.target.value)} placeholder="e.g. United States" />
      </label>
    </div>
  );
}

function StepReview({ data }) {
  const levelLabel = LEVELS.find(l => l.value === data.skating_level)?.label ?? 'Not set';
  const discLabel  = DISCIPLINES.find(d => d.value === data.discipline)?.label ?? 'Not set';
  const roleLabel  = ROLES.find(r => r.value === data.partner_role)?.label ?? 'Not set';
  return (
    <div className="step">
      <h2>Step 6: Review</h2>
      <table className="review-table">
        <tbody>
          <tr><td>Name</td><td>{data.name || 'Not set'}</td></tr>
          <tr><td>Email</td><td>{data.email || 'Not set'}</td></tr>
          <tr><td>Age</td><td>{data.age || 'Not set'}</td></tr>
          <tr><td>Discipline</td><td>{discLabel}</td></tr>
          <tr><td>Role</td><td>{roleLabel}</td></tr>
          <tr><td>Height</td><td>{data.height_cm ? `${data.height_cm} cm` : 'Not set'}</td></tr>
          <tr><td>Level</td><td>{levelLabel}</td></tr>
          <tr><td>Club</td><td>{data.club_name || 'Not set'}</td></tr>
          <tr><td>Coach</td><td>{data.coach_name || 'Not set'}</td></tr>
          <tr><td>Training hrs/wk</td><td>{data.training_hours_wk || 'Not set'}</td></tr>
          <tr><td>Goals</td><td>{data.goals || 'Not set'}</td></tr>
          <tr><td>Max distance</td><td>{data.max_distance_km} km</td></tr>
          <tr><td>Location</td><td>{[data.location_city, data.location_state, data.location_country].filter(Boolean).join(', ') || 'Not set'}</td></tr>
          <tr><td>Instagram</td><td>{data.instagram_handle || 'Not set'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit form with completeness bar
// ---------------------------------------------------------------------------
const STEPS      = [StepBasics, StepPhysical, StepSkating, StepGoals, StepLocation, StepReview];
const STEP_LABELS = ['Basics', 'Physical', 'Skating', 'Goals', 'Location', 'Review'];
const REQUIRED    = [
  ['name', 'email', 'password', 'discipline', 'partner_role'],
  ['height_cm'], ['skating_level'], [], [], [],
];

const EMPTY = {
  name: '', email: '', password: '', age: '', discipline: '', partner_role: '',
  height_cm: 0, weight_kg: null, _ft: '', _inches: '',
  skating_level: '', club_name: '', coach_name: '', training_hours_wk: null,
  goals: '', preferred_level_min: '', preferred_level_max: '', max_distance_km: 500,
  location_city: '', location_state: '', location_country: 'United States',
  instagram_handle: '',
};

function EditForm({ athlete, user, onSaved, onCancel }) {
  const { refetchAthlete } = useAuth();
  const navigate = useNavigate();
  const isEdit = !!athlete;

  const [step, setStep]   = useState(0);
  const [data, setData]   = useState(() => {
    if (!athlete) return { ...EMPTY, email: user?.email ?? '' };
    const { ft, inches } = cmToFtIn(athlete.height_cm ?? 0);
    return {
      name:                athlete.name ?? '',
      email:               athlete.email ?? user?.email ?? '',
      password:            '',
      age:                 athlete.age ?? '',
      discipline:          athlete.discipline ?? '',
      partner_role:        athlete.partner_role ?? '',
      height_cm:           athlete.height_cm ?? 0,
      weight_kg:           athlete.weight_kg ?? null,
      _ft:                 ft,
      _inches:             inches,
      skating_level:       athlete.skating_level ?? '',
      club_name:           athlete.club_name ?? '',
      coach_name:          athlete.coach_name ?? '',
      training_hours_wk:   athlete.training_hours_wk ?? null,
      goals:               athlete.goals ?? '',
      preferred_level_min: athlete.preferred_level_min ?? '',
      preferred_level_max: athlete.preferred_level_max ?? '',
      max_distance_km:     athlete.max_distance_km ?? 500,
      location_city:       athlete.location_city ?? '',
      location_state:      athlete.location_state ?? '',
      location_country:    athlete.location_country ?? 'United States',
      instagram_handle:    athlete.instagram_handle ?? '',
    };
  });
  const [error,  setError]      = useState(null);
  const [saving, setSaving]     = useState(false);
  const [photoUrl, setPhotoUrl] = useState(athlete?.profile_photo_url ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const { pct } = completeness(isEdit ? { ...athlete, ...data } : null);

  function onChange(field, value) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5MB'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Photo must be JPG, PNG, or WebP');
      return;
    }
    if (!athlete?.id) { setError('Save your profile first, then upload a photo'); return; }
    setPhotoUploading(true);
    setError(null);
    const ext = file.name.split('.').pop();
    const path = `${athlete.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('athlete-photos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) { setError(uploadErr.message); setPhotoUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('athlete-photos').getPublicUrl(path);
    const { error: updateErr } = await supabase
      .from('athletes')
      .update({ profile_photo_url: publicUrl })
      .eq('id', athlete.id);
    if (updateErr) { setError(updateErr.message); setPhotoUploading(false); return; }
    setPhotoUrl(publicUrl);
    await refetchAthlete();
    setPhotoUploading(false);
  }

  function validateStep() {
    const required = step === 0 && user
      ? REQUIRED[0].filter(f => f !== 'email' && f !== 'password')
      : REQUIRED[step];
    for (const field of required) {
      if (!data[field] && data[field] !== 0) return `${field.replace(/_/g, ' ')} is required`;
    }
    if (step === 0 && !user && data.password.length < 8) return 'Password must be at least 8 characters';
    if (step === 1 && data.height_cm < 100) return 'Please enter a valid height';
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep(s => s + 1);
  }

  function back() {
    setError(null);
    setStep(s => s - 1);
  }

  function athletePayload() {
    return {
      name:                data.name,
      email:               data.email || user?.email,
      age:                 data.age ? parseInt(data.age) : null,
      discipline:          data.discipline,
      skating_level:       data.skating_level,
      partner_role:        data.partner_role,
      height_cm:           data.height_cm,
      weight_kg:           data.weight_kg,
      club_name:           data.club_name || null,
      coach_name:          data.coach_name || null,
      training_hours_wk:   data.training_hours_wk,
      goals:               data.goals || null,
      preferred_level_min: data.preferred_level_min || null,
      preferred_level_max: data.preferred_level_max || null,
      max_distance_km:     data.max_distance_km,
      location_city:       data.location_city || null,
      location_state:      data.location_state || null,
      location_country:    data.location_country || 'United States',
      instagram_handle:    data.instagram_handle || null,
    };
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('athletes')
          .update(athletePayload())
          .eq('id', athlete.id);
        if (updateError) throw updateError;
        await refetchAthlete();
        onSaved();
        return;
      }

      let userId;
      if (user) {
        userId = user.id;
      } else {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: data.email, password: data.password,
        });
        if (signUpError) throw signUpError;
        userId = authData.user?.id;
        if (!userId) throw new Error('Sign-up succeeded but no user ID returned');
        if (!authData.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email, password: data.password,
          });
          if (signInError) throw signInError;
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from('athletes')
        .insert({ user_id: userId, source: 'self', search_status: 'active', ...athletePayload() })
        .select('id')
        .single();
      if (insertError) throw insertError;

      await supabase.rpc('score_new_athlete', { new_athlete_id: inserted.id });
      await refetchAthlete();
      navigate('/matches');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const StepComponent = STEPS[step];

  return (
    <div className="profile-wizard">
      {/* Completeness bar + photo upload — edit mode only */}
      {isEdit && (
        <div style={{
          background: '#fff', border: '1px solid #d4e0f5', borderRadius: 10,
          padding: '12px 16px', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: '#dce8fc', color: '#1a56db',
                fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {getInitials(data.name)}
              </div>
            )}
            <label style={{
              background: '#f0f4fb', color: '#1a3a6b',
              border: '1px solid #d4e0f5', borderRadius: 7,
              padding: '6px 12px', fontSize: 12, fontWeight: 600,
              cursor: photoUploading ? 'not-allowed' : 'pointer',
              opacity: photoUploading ? 0.6 : 1,
            }}>
              {photoUploading ? 'Uploading...' : 'Upload photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
                disabled={photoUploading}
              />
            </label>
          </div>
          <div style={{ fontSize: 12, color: '#4a5a7a', marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{pct}% complete</span>
          </div>
          <div style={{ height: 6, background: '#e8eef7', borderRadius: 3 }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${pct}%`,
              background: pct >= 80 ? '#27a845' : '#1a56db',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      <div className="wizard-progress">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className={`wizard-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`}>
            <span className="dot" />
            <span className="dot-label">{label}</span>
          </div>
        ))}
      </div>

      <form onSubmit={e => e.preventDefault()}>
        <StepComponent data={data} onChange={onChange} isExistingUser={!!user} />

        {error && <p className="form-error">{error}</p>}

        <div className="wizard-nav">
          {step > 0 ? (
            <button type="button" onClick={back} disabled={saving}>Back</button>
          ) : (
            isEdit
              ? <button type="button" onClick={onCancel} style={{ color: '#7a8aaa' }}>Cancel</button>
              : <span />
          )}
          {step < STEPS.length - 1 && (
            <button type="button" onClick={next}>Next</button>
          )}
          {step === STEPS.length - 1 && (
            <button type="button" onClick={submit} disabled={saving}>
              {saving
                ? (isEdit ? 'Saving...' : 'Creating profile...')
                : (isEdit ? 'Save changes' : 'Find my matches')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Profile component
// ---------------------------------------------------------------------------
export default function Profile() {
  const { user, athlete } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast]       = useState(null);

  const isNewAthlete = !!user && !athlete;

  if (isNewAthlete || editMode) {
    return (
      <>
        <EditForm
          athlete={athlete}
          user={user}
          onSaved={() => { setEditMode(false); setToast('Profile updated'); }}
          onCancel={() => setEditMode(false)}
        />
        {toast && <Toast msg={toast} onHide={() => setToast(null)} />}
      </>
    );
  }

  if (!user) {
    return (
      <main style={{ background: '#f4f7fb', padding: '24px 28px' }}>
        <p style={{ color: '#7a8aaa', fontSize: 14 }}>
          Sign in to view your profile.{' '}
          <a href="/signup" style={{ color: '#1a56db' }}>Sign in</a>
        </p>
      </main>
    );
  }

  return (
    <>
      <main style={{ background: '#f4f7fb', minHeight: 'calc(100vh - 52px)' }}>
        <ProfileView athlete={athlete} onEdit={() => setEditMode(true)} />
      </main>
      {toast && <Toast msg={toast} onHide={() => setToast(null)} />}
    </>
  );
}
