/**
 * TryoutModal, Phase 3.1
 * Opens when athlete clicks "Request try-out" on a match card.
 * Inserts a row into the tryouts table with proposed date/time/location.
 * Email notification is handled server-side (Supabase Edge Function, Phase 3.2).
 */
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

function lastInitial(fullName) {
  if (!fullName) return 'Unknown';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export default function TryoutModal({ match, onClose, onSuccess }) {
  const { athlete } = useAuth();
  const partner = match.partner;

  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!proposedDate) { setError('Please select a proposed date.'); return; }
    setSubmitting(true);
    setError(null);

    const { error: insertErr } = await supabase.from('tryouts').insert({
      requester_id:  athlete.id,
      recipient_id:  partner.id,
      score_id:      match.id,
      proposed_date: proposedDate || null,
      proposed_time: proposedTime || null,
      location_note: locationNote || null,
      status:        'requested',
    });

    setSubmitting(false);
    if (insertErr) { setError(insertErr.message); return; }
    onSuccess?.();
    onClose();
  }

  // Today's date as minimum value for the date picker
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request try-out</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="modal-partner-name">
          with <strong>{partner.name}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            Proposed date
            <input
              type="date"
              min={today}
              value={proposedDate}
              onChange={e => setProposedDate(e.target.value)}
              required
            />
          </label>

          <label>
            Proposed time <span className="optional">(optional)</span>
            <input
              type="time"
              value={proposedTime}
              onChange={e => setProposedTime(e.target.value)}
            />
          </label>

          <label>
            Location / rink <span className="optional">(optional)</span>
            <input
              type="text"
              placeholder="e.g. Peninsula Skating Club, Rink 2"
              value={locationNote}
              onChange={e => setLocationNote(e.target.value)}
              maxLength={200}
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
