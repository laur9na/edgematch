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
  requested:  { label: 'Pending',   bg: '#e6f0ff', color: '#1a56db'  },
  confirmed:  { label: 'Confirmed', bg: '#e1f5ee', color: '#0f6e56'  },
  completed:  { label: 'Completed', bg: '#e1f5ee', color: '#085041'  },
  cancelled:  { label: 'Cancelled', bg: '#f0f0f0', color: '#7a8aaa'  },
  no_show:    { label: 'No-show',   bg: '#f0f0f0', color: '#7a8aaa'  },
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
  const [updating,      setUpdating]      = useState(false);

  async function updateStatus(status) {
    setUpdating(true);
    await supabase.from('tryouts').update({ status }).eq('id', tryout.id);
    setUpdating(false);
    onUpdate();
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
      background: '#fff', border: '1px solid #d4e0f5',
      borderRadius: 12, padding: 16, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#0f2a5e',
            textDecoration: isCancelled ? 'line-through' : 'none',
          }}>
            {partner?.name}
          </div>
          <div style={{ fontSize: 11, color: '#7a8aaa', marginTop: 2 }}>
            {[level, loc].filter(Boolean).join(' · ')}
          </div>
        </div>
        <Badge status={tryout.status} />
      </div>

      <div style={{ fontSize: 11, color: '#5a6a8a', marginTop: 8 }}>
        {formatDateTime(tryout.proposed_date, tryout.proposed_time)}
      </div>
      {tryout.location_note && (
        <div style={{ fontSize: 11, color: '#5a6a8a', marginTop: 2 }}>
          {tryout.location_note}
        </div>
      )}
      {tryout.outcome && (
        <div style={{ fontSize: 11, color: '#7a8aaa', marginTop: 2, fontStyle: 'italic' }}>
          {OUTCOME_LABELS[tryout.outcome] ?? tryout.outcome}
        </div>
      )}

      {!showOutcome && !confirmCancel && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {role === 'received' && tryout.status === 'requested' && (
            <>
              <button disabled={updating} onClick={() => updateStatus('confirmed')}
                style={{ background: '#1a56db', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Confirm
              </button>
              <button disabled={updating} onClick={() => updateStatus('cancelled')}
                style={{ background: '#fff', border: '1px solid #d4e0f5', color: '#7a8aaa', padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                Decline
              </button>
            </>
          )}
          {tryout.status === 'confirmed' && !tryout.outcome && (
            <button disabled={updating} onClick={() => setShowOutcome(true)}
              style={{ background: '#1a56db', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Mark completed
            </button>
          )}
          {!isCancelled && tryout.status !== 'completed' && (
            <button disabled={updating} onClick={() => setConfirmCancel(true)}
              style={{ background: '#fff', border: '1px solid #d4e0f5', color: '#7a8aaa', padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
          )}
        </div>
      )}

      {confirmCancel && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#f4f7fb', borderRadius: 8, fontSize: 12, color: '#4a5a7a' }}>
          Cancel this try-out?
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => { updateStatus('cancelled'); setConfirmCancel(false); }}
              style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              Yes, cancel
            </button>
            <button onClick={() => setConfirmCancel(false)}
              style={{ background: '#fff', border: '1px solid #d4e0f5', color: '#4a5a7a', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              Keep it
            </button>
          </div>
        </div>
      )}

      {showOutcome && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#f4f7fb', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#4a5a7a' }}>How did it go?</span>
          {Object.entries(OUTCOME_LABELS).map(([val, label]) => (
            <button key={val} disabled={updating} onClick={() => setOutcome(val)}
              style={{ background: '#fff', border: '1px solid #d4e0f5', color: '#0f2a5e', padding: '4px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
          <button onClick={() => setShowOutcome(false)}
            style={{ background: 'none', border: 'none', color: '#7a8aaa', fontSize: 12, cursor: 'pointer' }}>
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
      <main style={{ background: '#f4f7fb', padding: '24px 28px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f2a5e' }}>Try-outs</h1>
        <p style={{ color: '#7a8aaa', marginTop: 12 }}>
          You need a profile to manage try-outs.{' '}
          <a href="/profile/new" style={{ color: '#1a56db' }}>Create one</a>
        </p>
      </main>
    );
  }

  const list = tab === 'sent' ? sent : received;

  return (
    <main style={{ background: '#f4f7fb', padding: '24px 28px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f2a5e', letterSpacing: '-0.3px', marginBottom: 16 }}>
        Try-outs
      </h1>

      <div style={{ display: 'flex', marginBottom: 14, borderBottom: '2px solid #d4e0f5' }}>
        {[
          { key: 'sent',     label: 'Sent' },
          { key: 'received', label: 'Received' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            fontSize: 13, fontWeight: 600, padding: '8px 14px', cursor: 'pointer',
            background: 'none', border: 'none',
            color: tab === t.key ? '#1a56db' : '#7a8aaa',
            borderBottom: tab === t.key ? '2px solid #1a56db' : '2px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {t.label}
            {t.key === 'sent' && sent.length > 0 && (
              <span style={{ background: '#1a56db', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                {sent.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading && (
        <div>
          {[...Array(3)].map((_, i) => <div key={i} className="tryout-skeleton" style={{ marginBottom: 10 }} />)}
        </div>
      )}

      {!loading && list.length === 0 && (
        <div style={{ textAlign: 'center', color: '#7a8aaa', fontSize: 14, marginTop: tab === 'received' ? 40 : 60 }}>
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
