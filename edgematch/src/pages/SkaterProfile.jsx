/**
 * SkaterProfile.jsx (Phase 15.6)
 * Single-column, full-width card. No right sidebar.
 * Header: avatar + name + try-out button / meta row / score bar / dot row.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
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
    <span style={{ background: bg, color, padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {place}
    </span>
  );
}

// Inline dot indicator: "Label ●●●●○"
function DotItem({ label, value }) {
  const filled = Math.round((value ?? 0) * 5);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 12, color: '#4a5a7a', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0,1,2,3,4].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
            background: i < filled ? '#1a7a3a' : '#d4e0f5',
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
    <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f4fb' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.8px', color: '#7a8aaa', marginBottom: 10,
      }}>
        Competition results
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Event', 'Level', 'Segment', 'Place', 'Score'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '4px 8px',
                borderBottom: '1px solid #d4e0f5', color: '#7a8aaa', fontWeight: 700,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f4fb', color: '#0f2a5e' }}>
                {r.event_name}{r.event_year ? ` (${r.event_year})` : ''}
              </td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f4fb', color: '#4a5a7a' }}>
                {LEVEL_LABEL[r.level] ?? r.level}
              </td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f4fb', color: '#4a5a7a' }}>
                {r.segment}
              </td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f4fb', textAlign: 'center' }}>
                <PlaceBadge place={r.placement} />
              </td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f4fb', textAlign: 'right' }}>
                {r.total_score != null ? (
                  <span style={{
                    background: '#eef3fe', color: '#1a56db',
                    padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
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
          style={{ marginTop: 8, background: 'none', border: 'none', color: '#1a56db', fontSize: 12, cursor: 'pointer', padding: 0 }}
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

  const [partner, setPartner]     = useState(null);
  const [results, setResults]     = useState([]);
  const [matchRow, setMatchRow]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('athletes')
      .select('*, clubs(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setPartner(data ?? null);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('competition_results')
      .select('event_name, event_year, level, segment, placement, total_score')
      .eq('athlete_id', id)
      .order('event_year', { ascending: false })
      .then(({ data }) => setResults(data ?? []));
  }, [id]);

  useEffect(() => {
    if (!myAthlete?.id || !id) return;
    supabase
      .from('compatibility_scores')
      .select('*')
      .or(
        `and(athlete_a_id.eq.${myAthlete.id},athlete_b_id.eq.${id}),` +
        `and(athlete_a_id.eq.${id},athlete_b_id.eq.${myAthlete.id})`
      )
      .maybeSingle()
      .then(({ data }) => setMatchRow(data ?? null));
  }, [myAthlete?.id, id]);

  if (loading) return <div className="loading">Loading...</div>;

  if (!partner) {
    return (
      <main style={{ background: '#f4f7fb', padding: '24px 28px' }}>
        <p style={{ color: '#7a8aaa' }}>Skater not found.</p>
      </main>
    );
  }

  const score = matchRow?.total_score ?? 0;
  const scorePct = Math.round(score * 100);
  const loc = [partner.location_city, partner.location_state].filter(Boolean).join(', ');
  const ht = heightStr(partner.height_cm);
  const club = partner.clubs;

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

  const hasAbout = partner.goals || partner.training_hours_wk || partner.coach_name || (partner.club_name && !club);

  const modalMatch = matchRow
    ? { ...matchRow, partner }
    : { id: null, partner, total_score: score };

  return (
    <main style={{ background: '#f4f7fb', minHeight: 'calc(100vh - 56px)', padding: '24px 28px' }}>

      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          marginBottom: 16, background: 'none', border: 'none',
          fontSize: 13, color: '#1a56db', cursor: 'pointer', padding: 0,
        }}
      >
        &larr; Back to matches
      </button>

      {/* Single full-width card */}
      <div style={{
        background: '#fff', border: '1px solid #d4e0f5',
        borderRadius: 14, overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: 20, borderBottom: '1px solid #f0f4fb' }}>

          {/* Row 1: avatar + name + try-out button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: '#dce8fc', color: '#1a56db',
              fontSize: 18, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {getInitials(partner.name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f2a5e' }}>
                {partner.name}
              </div>
              {partner.instagram_handle && (
                <a
                  href={`https://instagram.com/${partner.instagram_handle}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#1a56db', textDecoration: 'none' }}
                >
                  @{partner.instagram_handle}
                </a>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{
                flexShrink: 0,
                background: '#1a56db', color: '#fff', border: 'none',
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Request try-out
            </button>
          </div>

          {/* Row 2: discipline / level / role / city / height */}
          {metaParts.length > 0 && (
            <div style={{ fontSize: 13, color: '#7a8aaa', marginBottom: 10 }}>
              {metaParts.join(' · ')}
            </div>
          )}

          {/* Row 3: score bar + percentage */}
          {matchRow && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ flex: 1, height: 6, background: '#e8eef7', borderRadius: 3 }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${scorePct}%`, background: '#1a7a3a',
                  }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a7a3a', minWidth: 40 }}>
                  {scorePct}%
                </span>
                <span style={{ fontSize: 12, color: '#7a8aaa' }}>match strength</span>
              </div>
            </div>
          )}

          {/* Row 4: component dots — all inline */}
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
                  background: url ? '#b5d4f4' : '#f4f7fb',
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
        <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f4fb' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: '#7a8aaa', marginBottom: 8,
          }}>
            About
          </div>
          {partner.goals && (
            <div style={{ fontSize: 13, color: '#4a5a7a', marginBottom: 4 }}>
              Goals: {partner.goals}
            </div>
          )}
          {partner.training_hours_wk && (
            <div style={{ fontSize: 13, color: '#4a5a7a', marginBottom: 4 }}>
              Training: {partner.training_hours_wk} hrs/week
            </div>
          )}
          {partner.coach_name && (
            <div style={{ fontSize: 13, color: '#4a5a7a', marginBottom: 4 }}>
              Coach: {partner.coach_name}
            </div>
          )}
          {partner.club_name && !club && (
            <div style={{ fontSize: 13, color: '#4a5a7a' }}>
              Club: {partner.club_name}
            </div>
          )}
          {!hasAbout && (
            <div style={{ fontSize: 13, color: '#7a8aaa' }}>No details added yet.</div>
          )}
        </div>

        {/* Club section */}
        {club && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f4fb' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.8px', color: '#7a8aaa', marginBottom: 8,
            }}>
              Club
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f2a5e', marginBottom: 6 }}>
              {club.name}
            </div>
            {club.website && (
              <div style={{ marginBottom: 4 }}>
                <a
                  href={club.website}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#1a56db', textDecoration: 'none' }}
                >
                  Visit website
                </a>
              </div>
            )}
            {club.contact_email && (
              <div style={{ marginBottom: 4 }}>
                <a
                  href={`mailto:${club.contact_email}`}
                  style={{ fontSize: 12, color: '#1a56db', textDecoration: 'none' }}
                >
                  {club.contact_email}
                </a>
              </div>
            )}
            {club.phone && (
              <div style={{ fontSize: 12, color: '#4a5a7a' }}>
                {club.phone}
              </div>
            )}
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
