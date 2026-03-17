/**
 * Admin.jsx, Phase 4.2 + 4.3
 * Club/coach dashboard. Requires athlete.is_admin = true.
 * Features: athlete table sorted by level/activity, endorse, CSV export.
 *
 * Invite flow (4.1): if not admin, show a club-code entry form that
 * links the user to a club and sets is_admin = true.
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const LEVEL_ORDER = [
  'pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult',
];
const LEVEL_LABELS = {
  pre_juvenile: 'Pre-Juv', juvenile: 'Juvenile', intermediate: 'Intermediate',
  novice: 'Novice', junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const ROLE_LABELS = { lady: 'Lady', man: 'Man', either: 'Either' };
const STATUS_LABELS = { active: 'Looking', matched: 'Matched', paused: 'Paused', inactive: 'Inactive' };

function lastInitial(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ---- Club invite gate ----
function ClubAccessGate({ onGranted }) {
  const { athlete, refetchAthlete } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    // Look up club by invite code
    const { data: club, error: clubErr } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('invite_code', code.trim())
      .maybeSingle();

    if (clubErr || !club) {
      setError('Invalid invite code. Check with your club administrator.');
      setLoading(false);
      return;
    }

    if (!athlete) {
      setError('You need an athlete profile before accessing the club dashboard.');
      setLoading(false);
      return;
    }

    // Link athlete to club and grant admin
    const { error: updateErr } = await supabase
      .from('athletes')
      .update({ club_id: club.id, is_admin: true })
      .eq('id', athlete.id);

    if (updateErr) { setError(updateErr.message); setLoading(false); return; }

    await refetchAthlete();
    setLoading(false);
    onGranted();
  }

  return (
    <main className="page-content">
      <div className="admin-gate">
        <h1>Club Dashboard</h1>
        <p className="admin-gate-desc">
          Enter your club's invite code to access the coach dashboard.
        </p>
        <form className="admin-gate-form" onSubmit={handleSubmit}>
          <label>
            Invite code
            <input
              type="text"
              placeholder="e.g. PENINSULA2025"
              value={code}
              onChange={e => setCode(e.target.value)}
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Verifying…' : 'Access dashboard'}
          </button>
        </form>
        <p className="admin-gate-note">
          Don't have a code?{' '}
          <a href="mailto:hello@edgematch.app">Contact us</a> to set up your club.
        </p>
      </div>
    </main>
  );
}

// ---- Main dashboard ----
function Dashboard({ athlete }) {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('level'); // 'level' | 'last_active' | 'name'
  const [endorsing, setEndorsing] = useState(null); // id being endorsed
  const [club, setClub] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Load club info
      if (athlete.club_id) {
        const { data: clubData } = await supabase
          .from('clubs')
          .select('name, city, state')
          .eq('id', athlete.club_id)
          .maybeSingle();
        setClub(clubData);
      }

      // Load all athletes in this club
      const { data, error: err } = await supabase
        .from('athletes')
        .select('id, name, discipline, skating_level, partner_role, age, height_cm, verified, search_status, last_active_at, created_at, coach_name')
        .eq('club_id', athlete.club_id)
        .neq('id', athlete.id);

      if (err) setError(err.message);
      setAthletes(data ?? []);
      setLoading(false);
    }

    if (athlete.club_id) load();
    else setLoading(false);
  }, [athlete.club_id, athlete.id]);

  const sorted = useMemo(() => {
    return [...athletes].sort((a, b) => {
      if (sort === 'level') {
        return LEVEL_ORDER.indexOf(b.skating_level) - LEVEL_ORDER.indexOf(a.skating_level);
      }
      if (sort === 'last_active') {
        return new Date(b.last_active_at ?? 0) - new Date(a.last_active_at ?? 0);
      }
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [athletes, sort]);

  async function endorse(id) {
    setEndorsing(id);
    await supabase.from('athletes').update({ verified: true }).eq('id', id);
    setAthletes(prev => prev.map(a => a.id === id ? { ...a, verified: true } : a));
    setEndorsing(null);
  }

  function exportCSV() {
    const header = ['Name', 'Discipline', 'Level', 'Role', 'Age', 'Height (cm)', 'Status', 'Verified', 'Last Active'];
    const rows = sorted.map(a => [
      a.name ?? '', a.discipline ?? '', a.skating_level ?? '', a.partner_role ?? '',
      a.age ?? '', a.height_cm ?? '', a.search_status ?? '',
      a.verified ? 'Yes' : 'No',
      a.last_active_at ? new Date(a.last_active_at).toLocaleDateString() : '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edgematch-club-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-content">
      <div className="admin-header">
        <div>
          <h1>{club?.name ?? 'Club'} Dashboard</h1>
          {club && (
            <p className="admin-subtitle">
              {[club.city, club.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {!loading && athletes.length === 0 && (
        <div className="empty-state">
          <p>No other athletes from your club have joined yet.</p>
          <p style={{ marginTop: 8, fontSize: '.85rem' }}>
            Share your club's invite code so teammates can link their profiles.
          </p>
        </div>
      )}

      {athletes.length > 0 && (
        <>
          <div className="admin-toolbar">
            <span className="admin-count">{athletes.length} athlete{athletes.length !== 1 ? 's' : ''}</span>
            <div className="sort-row">
              <span>Sort:</span>
              {['level', 'last_active', 'name'].map(s => (
                <button
                  key={s}
                  className={`sort-btn ${sort === s ? 'active' : ''}`}
                  onClick={() => setSort(s)}
                >
                  {s === 'last_active' ? 'Last active' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Level</th>
                  <th>Role</th>
                  <th>Age</th>
                  <th>Status</th>
                  <th>Last active</th>
                  <th>Verified</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(a => (
                  <tr key={a.id} className={a.verified ? '' : 'row-unverified'}>
                    <td className="td-name">{lastInitial(a.name)}</td>
                    <td>{LEVEL_LABELS[a.skating_level] ?? a.skating_level}</td>
                    <td>{ROLE_LABELS[a.partner_role] ?? a.partner_role}</td>
                    <td>{a.age ?? 'N/A'}</td>
                    <td>
                      <span className={`status-badge ${a.search_status === 'active' ? 'status-confirmed' : 'status-cancelled'}`}>
                        {STATUS_LABELS[a.search_status] ?? a.search_status}
                      </span>
                    </td>
                    <td className="td-muted">
                      {a.last_active_at
                        ? new Date(a.last_active_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Never'}
                    </td>
                    <td>
                      {a.verified
                        ? <span className="badge-verified">✓ Verified</span>
                        : <span className="badge-unverified">Unverified</span>}
                    </td>
                    <td>
                      {!a.verified && (
                        <button
                          className="btn-endorse"
                          disabled={endorsing === a.id}
                          onClick={() => endorse(a.id)}
                        >
                          {endorsing === a.id ? '…' : 'Endorse'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

// ---- Route component ----
export default function Admin() {
  const { user, athlete, loading } = useAuth();
  const [invited, setInvited] = useState(false);

  if (loading) return <div className="loading">Loading…</div>;

  if (!user) {
    return (
      <main className="page-content">
        <h1>Club Dashboard</h1>
        <p><a href="/signin">Sign in</a> to access the club dashboard.</p>
      </main>
    );
  }

  const isAdmin = athlete?.is_admin === true;

  if (!isAdmin && !invited) {
    return <ClubAccessGate onGranted={() => setInvited(true)} />;
  }

  if (!athlete) {
    return <main className="page-content"><p>Loading profile…</p></main>;
  }

  return <Dashboard athlete={athlete} />;
}
