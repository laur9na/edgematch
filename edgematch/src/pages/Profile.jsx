/**
 * Profile.jsx — Multi-step athlete profile creation (Phase 1.2)
 *
 * Steps:
 *   1. Basics      — name, email, age, discipline, partner role
 *   2. Physical    — height (ft/in ↔ cm toggle), weight (optional)
 *   3. Skating     — level, club, coach, training hrs/wk
 *   4. Goals       — free text, preferred level range, max travel distance
 *   5. Location    — city, state/province, country
 *   6. Review      — summary + submit
 *
 * On submit:
 *   1. Creates Supabase auth user (email + password)
 *   2. Inserts row into athletes table
 *   3. Redirects to /matches
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DISCIPLINES = [
  { value: 'pairs',     label: 'Pairs Skating' },
  { value: 'ice_dance', label: 'Ice Dance' },
  { value: 'synchro',   label: 'Synchronized Skating' },
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

// Convert ft + in → cm
function ftInToCm(ft, inches) {
  return Math.round((parseInt(ft || 0) * 12 + parseInt(inches || 0)) * 2.54);
}

// Convert cm → { ft, inches }
function cmToFtIn(cm) {
  const totalIn = cm / 2.54;
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) };
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function StepBasics({ data, onChange }) {
  return (
    <div className="step">
      <h2>Step 1 — Basics</h2>

      <label>Full name *
        <input value={data.name} onChange={e => onChange('name', e.target.value)} placeholder="First Last" required />
      </label>

      <label>Email *
        <input type="email" value={data.email} onChange={e => onChange('email', e.target.value)} placeholder="you@example.com" required />
      </label>

      <label>Password *
        <input type="password" value={data.password} onChange={e => onChange('password', e.target.value)} placeholder="At least 8 characters" minLength={8} required />
      </label>

      <label>Age
        <input type="number" value={data.age} onChange={e => onChange('age', e.target.value)} min={8} max={99} placeholder="e.g. 17" />
      </label>

      <label>Discipline *
        <select value={data.discipline} onChange={e => onChange('discipline', e.target.value)} required>
          <option value="">Select…</option>
          {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>

      <label>Your role *
        <select value={data.partner_role} onChange={e => onChange('partner_role', e.target.value)} required>
          <option value="">Select…</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
    </div>
  );
}

function StepPhysical({ data, onChange }) {
  const [unit, setUnit] = useState('imperial');

  function handleFtIn(field, val) {
    const ft      = field === 'ft'     ? val : (data._ft || 0);
    const inches  = field === 'inches' ? val : (data._inches || 0);
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
      <h2>Step 2 — Physical Info</h2>

      <label>Height *
        <div className="unit-toggle">
          <button type="button" className={unit === 'imperial' ? 'active' : ''} onClick={() => setUnit('imperial')}>ft / in</button>
          <button type="button" className={unit === 'metric' ? 'active' : ''} onClick={() => setUnit('metric')}>cm</button>
        </div>
        {unit === 'imperial' ? (
          <div className="inline-inputs">
            <input type="number" value={data._ft || ''} onChange={e => handleFtIn('ft', e.target.value)} min={3} max={7} placeholder="ft" style={{ width: 60 }} />
            <span>'</span>
            <input type="number" value={data._inches || ''} onChange={e => handleFtIn('inches', e.target.value)} min={0} max={11} placeholder="in" style={{ width: 60 }} />
            <span>"</span>
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
      <h2>Step 3 — Skating Background</h2>

      <label>Skating level *
        <select value={data.skating_level} onChange={e => onChange('skating_level', e.target.value)} required>
          <option value="">Select…</option>
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
      <h2>Step 4 — Goals & Preferences</h2>

      <label>What are your skating goals?
        <textarea
          value={data.goals}
          onChange={e => onChange('goals', e.target.value)}
          rows={4}
          placeholder="e.g. Compete at Junior Nationals by 2027, eventually aim for senior Grand Prix…"
        />
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
        <input
          type="number"
          value={data.max_distance_km}
          onChange={e => onChange('max_distance_km', parseInt(e.target.value) || 500)}
          min={50} max={20000} step={50}
          placeholder="500"
        />
        <span className="hint">Use a large number (e.g. 20000) if you're open to relocating internationally.</span>
      </label>
    </div>
  );
}

function StepLocation({ data, onChange }) {
  return (
    <div className="step">
      <h2>Step 5 — Location</h2>

      <label>City
        <input value={data.location_city} onChange={e => onChange('location_city', e.target.value)} placeholder="e.g. San Jose" />
      </label>

      <label>State / Province
        <input value={data.location_state} onChange={e => onChange('location_state', e.target.value)} placeholder="e.g. CA or Ontario" />
      </label>

      <label>Country
        <input value={data.location_country} onChange={e => onChange('location_country', e.target.value)} placeholder="e.g. United States" />
      </label>
    </div>
  );
}

function StepReview({ data }) {
  const levelLabel = LEVELS.find(l => l.value === data.skating_level)?.label ?? '—';
  const discLabel  = DISCIPLINES.find(d => d.value === data.discipline)?.label ?? '—';
  const roleLabel  = ROLES.find(r => r.value === data.partner_role)?.label ?? '—';

  return (
    <div className="step">
      <h2>Step 6 — Review</h2>
      <table className="review-table">
        <tbody>
          <tr><td>Name</td><td>{data.name || '—'}</td></tr>
          <tr><td>Email</td><td>{data.email || '—'}</td></tr>
          <tr><td>Age</td><td>{data.age || '—'}</td></tr>
          <tr><td>Discipline</td><td>{discLabel}</td></tr>
          <tr><td>Role</td><td>{roleLabel}</td></tr>
          <tr><td>Height</td><td>{data.height_cm ? `${data.height_cm} cm` : '—'}</td></tr>
          <tr><td>Weight</td><td>{data.weight_kg ? `${data.weight_kg} kg` : '—'}</td></tr>
          <tr><td>Level</td><td>{levelLabel}</td></tr>
          <tr><td>Club</td><td>{data.club_name || '—'}</td></tr>
          <tr><td>Coach</td><td>{data.coach_name || '—'}</td></tr>
          <tr><td>Training hrs/wk</td><td>{data.training_hours_wk || '—'}</td></tr>
          <tr><td>Goals</td><td>{data.goals || '—'}</td></tr>
          <tr><td>Max distance</td><td>{data.max_distance_km} km</td></tr>
          <tr><td>Location</td><td>{[data.location_city, data.location_state, data.location_country].filter(Boolean).join(', ') || '—'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Profile component
// ---------------------------------------------------------------------------

const EMPTY = {
  // step 1
  name: '', email: '', password: '', age: '', discipline: '', partner_role: '',
  // step 2
  height_cm: 0, weight_kg: null, _ft: '', _inches: '',
  // step 3
  skating_level: '', club_name: '', coach_name: '', training_hours_wk: null,
  // step 4
  goals: '', preferred_level_min: '', preferred_level_max: '', max_distance_km: 500,
  // step 5
  location_city: '', location_state: '', location_country: 'United States',
};

const STEPS = [StepBasics, StepPhysical, StepSkating, StepGoals, StepLocation, StepReview];
const STEP_LABELS = ['Basics', 'Physical', 'Skating', 'Goals', 'Location', 'Review'];

// Required fields per step (for basic front-end guard before advancing)
const REQUIRED = [
  ['name', 'email', 'password', 'discipline', 'partner_role'],
  ['height_cm'],
  ['skating_level'],
  [],  // goals optional
  [],  // location optional
  [],  // review — handled at submit
];

export default function Profile() {
  const [step, setStep]   = useState(0);
  const [data, setData]   = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { user, refetchAthlete } = useAuth();
  const navigate = useNavigate();

  function onChange(field, value) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  function validateStep() {
    for (const field of REQUIRED[step]) {
      if (!data[field] && data[field] !== 0) {
        return `${field.replace(/_/g, ' ')} is required`;
      }
    }
    if (step === 0 && data.password.length < 8) return 'Password must be at least 8 characters';
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

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      let userId;

      if (user) {
        // Already authenticated (e.g. returning user whose athlete row was never
        // created due to a prior RLS error). Skip signUp entirely.
        userId = user.id;
      } else {
        // 1. Create auth user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
        });
        if (signUpError) throw signUpError;

        userId = authData.user?.id;
        if (!userId) throw new Error('Sign-up succeeded but no user ID returned');

        // 2. Ensure session is active before the RLS-gated INSERT.
        //    mailer_autoconfirm=true means signUp returns a session immediately;
        //    sign in explicitly as a fallback.
        if (!authData.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });
          if (signInError) throw signInError;
        }
      }

      // 3. Insert athlete row (RLS: auth.uid() must equal user_id)
      //    Use .select('id') to get the new athlete's PK (different from userId/user_id).
      const { data: inserted, error: insertError } = await supabase
        .from('athletes')
        .insert({
          user_id:             userId,
          name:                data.name,
          email:               data.email,
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
          source:              'self',
          search_status:       'active',
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      // 4. Score this athlete against all existing athletes.
      //    score_new_athlete takes the athlete's PK (athletes.id), not the auth user ID.
      //    Don't throw on failure — scoring can be retried; don't block profile creation.
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
      {/* Progress bar */}
      <div className="wizard-progress">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className={`wizard-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`}>
            <span className="dot" />
            <span className="dot-label">{label}</span>
          </div>
        ))}
      </div>

      <form onSubmit={e => e.preventDefault()}>
        <StepComponent data={data} onChange={onChange} />

        {error && <p className="form-error">{error}</p>}

        <div className="wizard-nav">
          {step > 0 && (
            <button type="button" onClick={back} disabled={saving}>Back</button>
          )}
          {step < STEPS.length - 1 && (
            <button type="button" onClick={next}>Next</button>
          )}
          {step === STEPS.length - 1 && (
            <button type="button" onClick={submit} disabled={saving}>
              {saving ? 'Creating profile…' : 'Find my matches →'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
