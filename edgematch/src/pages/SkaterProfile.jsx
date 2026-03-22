/**
 * SkaterProfile.jsx (Phase 15.6)
 * Single-column, full-width card. No right sidebar.
 * Competition results: fuzzy match by skater_name.
 * Club: joined club_id first, then fuzzy club_name match, then raw text fallback.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useAthlete } from '../hooks/useAthlete';
import TryoutModal from '../components/TryoutModal';

const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' };
const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};
const ROLE_LABEL = {
  lady: 'Skates as lady', man: 'Skates as man', either: 'Either role',
};

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

function PlaceBadge({ place }) {
  if (!place) return <span style={{ color: '#4a5a7a' }}>-</span>;
  const p = parseInt(place);
  let bg = '#f0f4fb', color = '#4a5a7a';
  if (p === 1) { bg = '#fef3c7'; color = '#92400e'; }
  else if (p === 2) { bg = '#f1f5f9'; color = '#475569'; }
  else if (p === 3) { bg = '#fce8dc'; color = '#9a3412'; }
  return (
    <span style={{
      background: bg, color, fontSize: 11, fontWeight: 700,
      width: 24, height: 24, borderRadius: '50%', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {place}
    </span>
  );
}

function DotItem({ label, value }) {
  const filled = Math.round((value ?? 0) * 5);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.5)', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0,1,2,3,4].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
            background: i < filled ? '#c9a96e' : 'rgba(201,169,110,0.2)',
          }} />
        ))}
      </div>
    </div>
  );
}

function CompetitionResults({ results }) {
  const [showAll, setShowAll] = useState(false);
  if (!results || results.length === 0) return null;
  const visible = showAll ? results : results.slice(0, 10);

  return (
    <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(201,169,110,0.1)' }}>
      <div style={{
        fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.14em', color: '#c9a96e', marginBottom: 12,
      }}>
        Competition results
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr>
            {['Event', 'Level', 'Segment', 'Place', 'Score'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '4px 8px',
                borderBottom: '1px solid rgba(201,169,110,0.12)',
                color: 'rgba(253,252,248,0.45)', fontWeight: 600, fontSize: '0.65rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: '7px 8px', borderBottom: '1px solid rgba(201,169,110,0.06)', color: '#fdfcf8' }}>
                {r.event_name}{r.event_year ? ` (${r.event_year})` : ''}
              </td>
              <td style={{ padding: '7px 8px', borderBottom: '1px solid rgba(201,169,110,0.06)', color: 'rgba(253,252,248,0.65)' }}>
                {LEVEL_LABEL[r.level] ?? r.level}
              </td>
              <td style={{ padding: '7px 8px', borderBottom: '1px solid rgba(201,169,110,0.06)', color: 'rgba(253,252,248,0.65)' }}>
                {r.segment}
              </td>
              <td style={{ padding: '7px 8px', borderBottom: '1px solid rgba(201,169,110,0.06)', textAlign: 'center' }}>
                <PlaceBadge place={r.placement} />
              </td>
              <td style={{ padding: '7px 8px', borderBottom: '1px solid rgba(201,169,110,0.06)', textAlign: 'right' }}>
                {r.total_score != null ? (
                  <span style={{
                    background: 'rgba(201,169,110,0.15)', color: '#c9a96e',
                    padding: '2px 7px', borderRadius: 2, fontSize: '0.72rem', fontWeight: 600,
                  }}>
                    {r.total_score}
                  </span>
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length > 10 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{ marginTop: 8, background: 'none', border: 'none', color: '#c9a96e', fontSize: '0.78rem', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
        >
          View all ({results.length})
        </button>
      )}
    </div>
  );
}

export default function SkaterProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { athlete: myAthlete } = useAuth();

  const { data: partner = null, isLoading: loading } = useAthlete(id);
  const [results, setResults]     = useState([]);
  const [club, setClub]           = useState(null);
  const [matchRow, setMatchRow]   = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Derive club from join; fall back to fuzzy name match
  useEffect(() => {
    if (!partner) return;
    if (partner.clubs) { setClub(partner.clubs); return; }
    if (!partner.club_name) return;
    let cancelled = false;
    supabase
      .from('clubs')
      .select('*')
      .ilike('name', `%${partner.club_name}%`)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setClub(data); });
    return () => { cancelled = true; };
  }, [partner]);

  // Load competition results: try First Last, Last First, then last name only
  // IJS stores names as "LASTNAME Firstname", athletes table stores "Firstname Lastname"
  useEffect(() => {
    if (!partner?.name) return;
    const parts = partner.name.trim().split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastName = parts[parts.length - 1] ?? '';
    if (!lastName) return;
    let cancelled = false;

    supabase
      .from('competition_results')
      .select('*')
      .or(`skater_name.ilike.%${firstName}%${lastName}%,skater_name.ilike.%${lastName}%${firstName}%`)
      .order('event_year', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        if (data && data.length > 0) {
          setResults(data);
        } else {
          supabase
            .from('competition_results')
            .select('*')
            .ilike('skater_name', `%${lastName}%`)
            .order('event_year', { ascending: false })
            .then(({ data: fb }) => { if (!cancelled) setResults(fb ?? []); });
        }
      });
    return () => { cancelled = true; };
  }, [partner?.name]);

  // Load match score
  useEffect(() => {
    if (!myAthlete?.id || !id) return;
    let cancelled = false;
    supabase
      .from('compatibility_scores')
      .select('*')
      .or(
        `and(athlete_a_id.eq.${myAthlete.id},athlete_b_id.eq.${id}),` +
        `and(athlete_a_id.eq.${id},athlete_b_id.eq.${myAthlete.id})`
      )
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setMatchRow(data ?? null); });
    return () => { cancelled = true; };
  }, [myAthlete?.id, id]);

  if (loading) return <div className="loading">Loading...</div>;

  if (!partner) {
    return (
      <main style={{ background: '#0d1b2e', padding: '24px 28px' }}>
        <p style={{ color: 'rgba(253,252,248,0.65)' }}>Skater not found.</p>
      </main>
    );
  }

  const score = matchRow?.total_score ?? 0;
  const scorePct = Math.round(score * 100);
  const loc = [partner.location_city, partner.location_state].filter(Boolean).join(', ');
  const ht = heightStr(partner.height_cm);

  const metaParts = [
    DISCIPLINE_LABEL[partner.discipline],
    LEVEL_LABEL[partner.skating_level],
    ROLE_LABEL[partner.partner_role],
    loc,
    ht,
  ].filter(Boolean);

  const mediaUrls = partner.media_urls ?? [];
  const cells = Array.from({ length: 9 }, (_, i) => mediaUrls[i] ?? null);
  const hasMedia = cells.some(c => c !== null);

  const hasAbout = partner.goals || partner.training_hours_wk || partner.coach_name;
  const hasClub  = club || partner.club_name;

  const modalMatch = matchRow
    ? { ...matchRow, partner }
    : { id: null, partner, total_score: score };

  return (
    <main style={{ background: '#0d1b2e', minHeight: 'calc(100vh - 52px)', padding: '24px 28px' }}>

      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          marginBottom: 16, background: 'none', border: 'none',
          fontSize: '0.78rem', color: '#c9a96e', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
        }}
      >
        &larr; Back to matches
      </button>

      {/* Single full-width card */}
      <div style={{
        background: '#142236', border: '1px solid rgba(201,169,110,0.15)',
        borderRadius: 4, overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: 24, borderBottom: '1px solid rgba(201,169,110,0.1)' }}>

          {/* Row 1: avatar + name + try-out button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(201,169,110,0.15)', color: '#c9a96e',
              fontSize: 18, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(201,169,110,0.3)',
            }}>
              {getInitials(partner.name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 300, color: '#fdfcf8' }}>
                {partner.name}
              </div>
              {partner.instagram_handle && (
                <a
                  href={`https://instagram.com/${partner.instagram_handle}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.78rem', color: '#c9a96e', textDecoration: 'none' }}
                >
                  @{partner.instagram_handle}
                </a>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{
                flexShrink: 0,
                background: '#c9a96e', color: '#0d1b2e', border: 'none',
                padding: '10px 24px', borderRadius: 2, fontSize: '0.75rem', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit',
              }}
            >
              Request try-out
            </button>
          </div>

          {/* Row 2: discipline / level / role / city / height */}
          {metaParts.length > 0 && (
            <div style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.65)', marginBottom: 12 }}>
              {metaParts.join(' · ')}
            </div>
          )}

          {/* Row 3: score bar + percentage */}
          {matchRow && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ flex: 1, height: 3, background: 'rgba(201,169,110,0.2)', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${scorePct}%`, background: '#c9a96e',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#c9a96e', minWidth: 36 }}>
                  {scorePct}%
                </span>
                <span style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.45)' }}>match</span>
              </div>
            </div>
          )}

          {/* Row 4: component dots */}
          {matchRow && (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <DotItem label="Height"      value={matchRow.height_score} />
              <DotItem label="Skill level" value={matchRow.level_score} />
              <DotItem label="Role fit"    value={matchRow.role_score} />
              <DotItem label="Distance"    value={matchRow.location_score} />
            </div>
          )}
        </div>

        {/* Media grid */}
        {hasMedia && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
            {cells.map((url, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '1/1', overflow: 'hidden',
                  background: '#1c3050',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {url && (
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
                )}
              </div>
            ))}
          </div>
        )}

        {/* About section */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(201,169,110,0.1)' }}>
          <div style={{
            fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.14em', color: '#c9a96e', marginBottom: 10,
          }}>
            About
          </div>
          {partner.goals && (
            <div style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.65)', marginBottom: 6, lineHeight: 1.65 }}>
              Goals: {partner.goals}
            </div>
          )}
          {partner.training_hours_wk && (
            <div style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.65)', marginBottom: 6 }}>
              Training: {partner.training_hours_wk} hrs/week
            </div>
          )}
          {partner.coach_name && (
            <div style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.65)' }}>
              Coach: {partner.coach_name}
            </div>
          )}
          {!hasAbout && (
            <div style={{ fontSize: '0.82rem', color: 'rgba(253,252,248,0.4)' }}>No details added yet.</div>
          )}
        </div>

        {/* Club section: joined record > fuzzy lookup > raw club_name text */}
        {hasClub && (
          <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(201,169,110,0.1)' }}>
            <div style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.14em', color: '#c9a96e', marginBottom: 10,
            }}>
              Club
            </div>
            <div style={{
              background: '#1c3050', border: '1px solid rgba(201,169,110,0.15)',
              borderRadius: 2, padding: 14,
            }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fdfcf8', marginBottom: 8 }}>
                {club ? club.name : partner.club_name}
              </div>
              {club?.website && (
                <div style={{ marginBottom: 4 }}>
                  <a
                    href={club.website}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.78rem', color: '#c9a96e', textDecoration: 'none' }}
                  >
                    Visit website
                  </a>
                </div>
              )}
              {club?.contact_email && (
                <div style={{ marginBottom: 4 }}>
                  <a
                    href={`mailto:${club.contact_email}`}
                    style={{ fontSize: '0.78rem', color: '#c9a96e', textDecoration: 'none' }}
                  >
                    {club.contact_email}
                  </a>
                </div>
              )}
              {club?.phone && (
                <div style={{ fontSize: '0.78rem', color: 'rgba(253,252,248,0.65)' }}>
                  {club.phone}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Competition results */}
        <CompetitionResults results={results} />
      </div>

      {showModal && (
        <TryoutModal
          match={modalMatch}
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
        />
      )}
    </main>
  );
}
