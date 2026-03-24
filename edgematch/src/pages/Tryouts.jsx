/**
 * Tryouts.jsx, Phase 7.5
 * Two tabs: Sent / Received. Try-out cards with spec-exact styling.
 */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTryouts } from '../hooks/useTryouts';
import { supabase } from '../lib/supabase';

const LEVEL_LABEL = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};

const STATUS_BADGE = {
  requested:  { label: 'Pending',   bg: 'rgba(201,169,110,0.12)', color: '#c9a96e'               },
  confirmed:  { label: 'Confirmed', bg: 'rgba(74,222,128,0.12)',  color: '#4ade80'               },
  completed:  { label: 'Completed', bg: 'rgba(74,222,128,0.08)',  color: 'rgba(74,222,128,0.7)'  },
  cancelled:  { label: 'Cancelled', bg: 'rgba(253,252,248,0.06)', color: 'rgba(253,252,248,0.4)' },
  no_show:    { label: 'No-show',   bg: 'rgba(253,252,248,0.06)', color: 'rgba(253,252,248,0.4)' },
};

const OUTCOME_LABELS = {
  great_fit:   'Great fit!',
  possible:    'Possible',
  not_a_fit:   'Not a fit',
};

function formatDateTime(date, time) {
  const d = date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }) : null;
  const t = time ? time.slice(0, 5) : null;
  return [d, t].filter(Boolean).join(' at ') || 'Date TBD';
}

function Badge({ status }) {
  const b = STATUS_BADGE[status] ?? STATUS_BADGE.requested;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      background: b.bg, color: b.color,
    }}>
      {b.label}
    </span>
  );
}

function lastInitial(name) {
  if (!name) return 'Unknown';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}

function TryoutCard({ tryout, role, onUpdate }) {
  const partner    = role === 'sent' ? tryout.recipient : tryout.requester;
  const isCancelled = tryout.status === 'cancelled' || tryout.status === 'no_show';
  const [showOutcome,   setShowOutcome]   = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [updating,      setUpdating]      = useState(false);
  const [deleteError,   setDeleteError]   = useState(null);

  async function updateStatus(status) {
    setUpdating(true);
    await supabase.from('tryouts').update({ status }).eq('id', tryout.id);
    setUpdating(false);
    onUpdate();
  }

  async function deleteTryout() {
    setUpdating(true);
    setDeleteError(null);
    const { error } = await supabase.from('tryouts').delete().eq('id', tryout.id);
    setUpdating(false);
    if (error) {
      setDeleteError('Delete failed: database policy not applied yet.');
      setConfirmDelete(false);
    } else {
      onUpdate();
    }
  }

  async function setOutcome(outcome) {
    setUpdating(true);
    await supabase.from('tryouts')
      .update({ outcome, status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', tryout.id);
    setUpdating(false);
    setShowOutcome(false);
    onUpdate();
  }

  const level = partner?.skating_level ? (LEVEL_LABEL[partner.skating_level] ?? partner.skating_level) : null;
  const loc   = [partner?.location_city, partner?.location_state].filter(Boolean).join(', ');

  return (
    <div style={{
      background: '#142236', border: '1px solid rgba(201,169,110,0.12)',
      borderRadius: 4, padding: 18, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontSize: '0.88rem', fontWeight: 600, color: '#fdfcf8',
            textDecoration: isCancelled ? 'line-through' : 'none',
          }}>
            {partner?.name}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.5)', marginTop: 2 }}>
            {[level, loc].filter(Boolean).join(' · ')}
          </div>
        </div>
        <Badge status={tryout.status} />
      </div>

      <div style={{ fontSize: '0.75rem', color: 'rgba(253,252,248,0.6)', marginTop: 10 }}>
        {formatDateTime(tryout.proposed_date, tryout.proposed_time)}
      </div>
      {tryout.location_note && (
        <div style={{ fontSize: '0.75rem', color: 'rgba(253,252,248,0.5)', marginTop: 3 }}>
          {tryout.location_note}
        </div>
      )}
      {tryout.outcome && (
        <div style={{ fontSize: '0.72rem', color: '#c9a96e', marginTop: 3, fontStyle: 'italic' }}>
          {OUTCOME_LABELS[tryout.outcome] ?? tryout.outcome}
        </div>
      )}

      {!showOutcome && !confirmCancel && !confirmDelete && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {role === 'received' && tryout.status === 'requested' && (
            <>
              <button disabled={updating} onClick={() => updateStatus('confirmed')}
                style={{ background: '#c9a96e', color: '#0d1b2e', border: 'none', padding: '6px 14px', borderRadius: 2, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em' }}>
                Confirm
              </button>
              <button disabled={updating} onClick={() => updateStatus('cancelled')}
                style={{ background: 'transparent', border: '1px solid rgba(201,169,110,0.2)', color: 'rgba(253,252,248,0.5)', padding: '5px 14px', borderRadius: 2, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Decline
              </button>
            </>
          )}
          {tryout.status === 'confirmed' && !tryout.outcome && (
            <button disabled={updating} onClick={() => setShowOutcome(true)}
              style={{ background: '#c9a96e', color: '#0d1b2e', border: 'none', padding: '6px 14px', borderRadius: 2, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Mark completed
            </button>
          )}
          {!isCancelled && tryout.status !== 'completed' && (
            <button disabled={updating} onClick={() => setConfirmCancel(true)}
              style={{ background: 'transparent', border: '1px solid rgba(201,169,110,0.15)', color: 'rgba(253,252,248,0.45)', padding: '5px 14px', borderRadius: 2, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          )}
          {role === 'sent' && (
            <button disabled={updating} onClick={() => setConfirmDelete(true)}
              style={{ background: 'transparent', border: 'none', color: 'rgba(253,252,248,0.25)', padding: '5px 8px', borderRadius: 2, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}
              title="Delete"
            >
              &#128465;
            </button>
          )}
        </div>
      )}

      {confirmCancel && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: '#1c3050', borderRadius: 2, border: '1px solid rgba(201,169,110,0.12)', fontSize: '0.78rem', color: 'rgba(253,252,248,0.65)' }}>
          Cancel this try-out?
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => { updateStatus('cancelled'); setConfirmCancel(false); }}
              style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 2, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Yes, cancel
            </button>
            <button onClick={() => setConfirmCancel(false)}
              style={{ background: 'transparent', border: '1px solid rgba(201,169,110,0.2)', color: 'rgba(253,252,248,0.5)', padding: '5px 12px', borderRadius: 2, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Keep it
            </button>
          </div>
        </div>
      )}

      {deleteError && (
        <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#dc2626' }}>{deleteError}</div>
      )}

      {confirmDelete && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: '#1c3050', borderRadius: 2, border: '1px solid rgba(220,38,38,0.2)', fontSize: '0.78rem', color: 'rgba(253,252,248,0.65)' }}>
          Delete this try-out permanently?
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={deleteTryout} disabled={updating}
              style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 2, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)}
              style={{ background: 'transparent', border: '1px solid rgba(201,169,110,0.2)', color: 'rgba(253,252,248,0.5)', padding: '5px 12px', borderRadius: 2, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Keep it
            </button>
          </div>
        </div>
      )}

      {showOutcome && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: '#1c3050', borderRadius: 2, border: '1px solid rgba(201,169,110,0.12)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(253,252,248,0.65)' }}>How did it go?</span>
          {Object.entries(OUTCOME_LABELS).map(([val, label]) => (
            <button key={val} disabled={updating} onClick={() => setOutcome(val)}
              style={{ background: 'transparent', border: '1px solid rgba(201,169,110,0.25)', color: '#c9a96e', padding: '4px 12px', borderRadius: 2, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
          <button onClick={() => setShowOutcome(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(253,252,248,0.45)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function Tryouts() {
  const { athlete, loading: authLoading } = useAuth();
  const { sent, received, loading, error, refetch } = useTryouts(athlete?.id);
  const [tab, setTab] = useState('sent');

  if (authLoading) return <div className="loading">Loading...</div>;

  if (!athlete) {
    return (
      <main style={{ background: '#0d1b2e', padding: '24px 28px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 300, color: '#fdfcf8' }}>Try-outs</h1>
        <p style={{ color: 'rgba(253,252,248,0.65)', marginTop: 12 }}>
          You need a profile to manage try-outs.{' '}
          <a href="/profile/new" style={{ color: '#c9a96e' }}>Create one</a>
        </p>
      </main>
    );
  }

  const list = tab === 'sent' ? sent : received;

  return (
    <main style={{ background: '#0d1b2e', padding: '24px 28px', minHeight: 'calc(100vh - 52px)' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 300, color: '#fdfcf8', marginBottom: 20 }}>
        Try-outs
      </h1>

      <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid rgba(201,169,110,0.15)' }}>
        {[
          { key: 'sent',     label: 'Sent' },
          { key: 'received', label: 'Received' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            fontSize: '0.82rem', fontWeight: 600, padding: '8px 16px', cursor: 'pointer',
            background: 'none', border: 'none', fontFamily: 'inherit',
            color: tab === t.key ? '#c9a96e' : 'rgba(253,252,248,0.5)',
            borderBottom: tab === t.key ? '2px solid #c9a96e' : '2px solid transparent',
            marginBottom: -1, display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {t.label}
            {t.key === 'sent' && sent.length > 0 && (
              <span style={{ background: '#c9a96e', color: '#0d1b2e', borderRadius: 10, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>
                {sent.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: 12 }}>{error}</p>}

      {loading && (
        <div>
          {[...Array(3)].map((_, i) => <div key={i} className="tryout-skeleton" style={{ marginBottom: 10 }} />)}
        </div>
      )}

      {!loading && list.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(253,252,248,0.45)', fontSize: '0.85rem', marginTop: tab === 'received' ? 40 : 60 }}>
          {tab === 'received' ? 'No one has requested a try-out yet.' : 'No try-out requests sent yet.'}
        </div>
      )}

      {!loading && list.length > 0 && (
        <div>
          {list.map(t => <TryoutCard key={t.id} tryout={t} role={tab} onUpdate={refetch} />)}
        </div>
      )}
    </main>
  );
}
