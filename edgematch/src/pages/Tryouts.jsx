/**
 * Tryouts.jsx, Phase 3.3
 * Two tabs: Sent requests / Received requests.
 * Shows partner name, proposed date, status badge, and outcome controls.
 */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTryouts } from '../hooks/useTryouts';
import { supabase } from '../lib/supabase';

const LEVEL_LABELS = {
  pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
  intermediate: 'Intermediate', novice: 'Novice',
  junior: 'Junior', senior: 'Senior', adult: 'Adult',
};

const STATUS_LABELS = {
  requested:  { label: 'Pending',   cls: 'status-pending'   },
  confirmed:  { label: 'Confirmed', cls: 'status-confirmed' },
  completed:  { label: 'Done',      cls: 'status-done'      },
  cancelled:  { label: 'Cancelled', cls: 'status-cancelled' },
  no_show:    { label: 'No-show',   cls: 'status-cancelled' },
};

const OUTCOME_LABELS = {
  great_fit:   'Great fit!',
  possible:    'Possible',
  not_a_fit:   'Not a fit',
};

function displayName(fullName) {
  if (!fullName) return 'Unknown';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function formatDate(d) {
  if (!d) return 'No date set';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] ?? { label: status, cls: 'status-pending' };
  return <span className={`status-badge ${s.cls}`}>{s.label}</span>;
}

function TryoutRow({ tryout, role, onUpdate }) {
  const partner = role === 'sent' ? tryout.recipient : tryout.requester;
  const [showOutcome, setShowOutcome] = useState(false);
  const [updating, setUpdating] = useState(false);

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

  return (
    <div className="tryout-row">
      <div className="tryout-row-main">
        <div className="tryout-partner">
          <span className="tryout-name">{displayName(partner?.name)}</span>
          {partner?.skating_level && (
            <span className="tryout-meta">{LEVEL_LABELS[partner.skating_level] ?? partner.skating_level}</span>
          )}
          {(partner?.location_city || partner?.location_state) && (
            <span className="tryout-meta muted">
              {[partner.location_city, partner.location_state].filter(Boolean).join(', ')}
            </span>
          )}
        </div>

        <div className="tryout-info">
          <span className="tryout-date">{formatDate(tryout.proposed_date)}</span>
          {tryout.proposed_time && (
            <span className="tryout-meta">{tryout.proposed_time.slice(0, 5)}</span>
          )}
          {tryout.location_note && (
            <span className="tryout-meta muted">{tryout.location_note}</span>
          )}
        </div>

        <div className="tryout-status-col">
          <StatusBadge status={tryout.status} />
          {tryout.outcome && (
            <span className="tryout-outcome">{OUTCOME_LABELS[tryout.outcome]}</span>
          )}
        </div>

        <div className="tryout-actions">
          {/* Recipient can confirm/decline a pending request */}
          {role === 'received' && tryout.status === 'requested' && (
            <>
              <button
                className="btn-action btn-confirm"
                disabled={updating}
                onClick={() => updateStatus('confirmed')}
              >Confirm</button>
              <button
                className="btn-action btn-decline"
                disabled={updating}
                onClick={() => updateStatus('cancelled')}
              >Decline</button>
            </>
          )}

          {/* Either side can mark confirmed → completed */}
          {tryout.status === 'confirmed' && !tryout.outcome && (
            <button
              className="btn-action btn-complete"
              disabled={updating}
              onClick={() => setShowOutcome(true)}
            >Log outcome</button>
          )}

          {/* Requester can cancel a pending request */}
          {role === 'sent' && tryout.status === 'requested' && (
            <button
              className="btn-action btn-decline"
              disabled={updating}
              onClick={() => updateStatus('cancelled')}
            >Cancel</button>
          )}
        </div>
      </div>

      {/* Outcome picker */}
      {showOutcome && (
        <div className="outcome-picker">
          <span>How did it go?</span>
          {Object.entries(OUTCOME_LABELS).map(([val, label]) => (
            <button
              key={val}
              className="btn-outcome"
              disabled={updating}
              onClick={() => setOutcome(val)}
            >{label}</button>
          ))}
          <button className="link-btn" onClick={() => setShowOutcome(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default function Tryouts() {
  const { athlete, loading: authLoading } = useAuth();
  const { sent, received, loading, error, refetch } = useTryouts(athlete?.id);
  const [tab, setTab] = useState('received');

  if (authLoading) return <div className="loading">Loading…</div>;

  if (!athlete) {
    return (
      <main className="page-content">
        <h1>Tryouts</h1>
        <p>You need a profile to manage tryouts. <a href="/profile/new">Create one →</a></p>
      </main>
    );
  }

  const list = tab === 'sent' ? sent : received;

  return (
    <main className="page-content">
      <div className="tryouts-header">
        <h1>Tryouts</h1>
      </div>

      <div className="tryouts-tabs">
        <button
          className={`tab-btn ${tab === 'received' ? 'active' : ''}`}
          onClick={() => setTab('received')}
        >
          Received
          {received.length > 0 && (
            <span className="tab-count">{received.length}</span>
          )}
        </button>
        <button
          className={`tab-btn ${tab === 'sent' ? 'active' : ''}`}
          onClick={() => setTab('sent')}
        >
          Sent
          {sent.length > 0 && (
            <span className="tab-count">{sent.length}</span>
          )}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading && (
        <div className="tryout-skeleton-list">
          {[...Array(3)].map((_, i) => <div key={i} className="tryout-skeleton" />)}
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="empty-state">
          <p>
            {tab === 'received'
              ? 'No one has requested a tryout with you yet.'
              : 'You haven\'t sent any tryout requests yet.'}
          </p>
          {tab === 'sent' && (
            <a href="/matches" className="btn-primary" style={{ marginTop: 12 }}>
              Browse matches
            </a>
          )}
        </div>
      )}

      {!loading && list.length > 0 && (
        <div className="tryout-list">
          {list.map(t => (
            <TryoutRow
              key={t.id}
              tryout={t}
              role={tab === 'sent' ? 'sent' : 'received'}
              onUpdate={refetch}
            />
          ))}
        </div>
      )}
    </main>
  );
}
