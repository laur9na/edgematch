/**
 * TryoutModal: manual matching flow.
 * Submits a tryout request and notifies Laurena via email.
 * Shows a confirmation screen after the request is sent.
 */
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

async function notifyEmail(tryoutId, requesterId, recipientId, note) {
  try {
    await supabase.functions.invoke('send-tryout-email', {
      body: {
        type: 'INSERT',
        table: 'tryouts',
        record: {
          id: tryoutId,
          requester_id: requesterId,
          recipient_id: recipientId,
          proposed_date: null,
          proposed_time: null,
          location_note: note || null,
          status: 'requested',
        },
        old_record: null,
      },
    });
  } catch {
    // Non-fatal; tryout row was saved regardless
  }
}

export default function TryoutModal({ match, onClose, onSuccess }) {
  const { athlete } = useAuth();
  const partner = match.partner;

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error: insertErr } = await supabase.from('tryouts').insert({
      requester_id:  athlete.id,
      recipient_id:  partner.id,
      score_id:      match.id ?? null,
      location_note: note || null,
      status:        'requested',
    }).select('id');

    setSubmitting(false);
    if (insertErr) { setError(insertErr.message); return; }

    // Fire email notification (non-blocking)
    const tryoutId = data?.[0]?.id ?? null;
    notifyEmail(tryoutId, athlete.id, partner.id, note);

    setSent(true);
    onSuccess?.();
  }

  const inputStyle = {
    width: '100%', background: '#1c3050', border: '1px solid rgba(201,169,110,0.2)',
    borderRadius: 2, color: '#fdfcf8', fontSize: '0.85rem', padding: '10px 14px',
    fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
  };

  if (sent) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '36px 32px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fdfcf8', marginBottom: 10 }}>
            Request sent!
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(253,252,248,0.65)', lineHeight: 1.6, marginBottom: 24 }}>
            Laurena has been notified and will reach out to both clubs to coordinate the on-ice session. Keep an eye on your email.
          </p>
          <button
            onClick={onClose}
            style={{
              background: '#c9a96e', color: '#0d1b2e', border: 'none',
              padding: '10px 32px', borderRadius: 2, fontSize: '0.82rem',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request try-out</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close" style={{ fontFamily: 'inherit' }}>×</button>
        </div>

        <p className="modal-partner-name">
          with <strong style={{ color: '#fdfcf8' }}>{partner.name}</strong>
        </p>

        <div style={{
          background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)',
          borderRadius: 2, padding: '12px 14px', marginBottom: 20,
          fontSize: '0.8rem', color: 'rgba(253,252,248,0.7)', lineHeight: 1.55,
        }}>
          EdgeMatch coordinates try-outs manually. Once you submit, Laurena will contact both clubs to arrange the on-ice session and follow up by email.
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{
              display: 'block', fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#c9a96e', marginBottom: 8,
            }}>
              Message <span style={{ color: 'rgba(253,252,248,0.4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </span>
            <textarea
              rows={3}
              placeholder="Any preferences or context for Laurena (location, availability, etc.)"
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={400}
              style={inputStyle}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
