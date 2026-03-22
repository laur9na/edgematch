/**
 * ContactModal.jsx
 * Opens when a user clicks "Request try-out" on an athlete card in ClubPage.
 * Shows the best available contact method, prioritized:
 *   1. coach_name + club contact_email → pre-filled mailto
 *   2. club website → visit link
 *   3. club contact_email (no coach) → plain mailto
 *   4. fallback → phone / city info
 */
import { useAuth } from '../hooks/useAuth';

function getFirstName(fullName) {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

function lastInitial(fullName) {
  if (!fullName) return 'Unknown';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export default function ContactModal({ athlete, club, onClose }) {
  const { athlete: me } = useAuth();
  const myName = me?.name ?? '';
  const athleteFirst = getFirstName(athlete.name);
  const subject = encodeURIComponent(
    `Try-out Request: ${myName} + ${athleteFirst}`
  );

  // Determine which contact method to show
  const hasCoach = !!athlete.coach_name;
  const hasEmail = !!club?.contact_email;
  const hasWebsite = !!club?.website;
  const hasPhone = !!club?.phone;

  let contactBlock;

  if (hasCoach && hasEmail) {
    // Priority 1: coach + club email
    contactBlock = (
      <div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.55)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          Contact coach
        </div>
        <div style={{ fontSize: '0.88rem', color: '#fdfcf8', marginBottom: 12 }}>
          {athlete.coach_name}
        </div>
        <a
          href={`mailto:${club.contact_email}?subject=${subject}`}
          style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            padding: '10px 0', textAlign: 'center',
            background: '#c9a96e', color: '#0d1b2e',
            border: 'none', borderRadius: 2,
            fontSize: '0.75rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Email {club.contact_email}
        </a>
        <div style={{ fontSize: '0.68rem', color: 'rgba(253,252,248,0.35)', marginTop: 8, textAlign: 'center' }}>
          Subject line pre-filled: Try-out Request: {myName || 'Your name'} + {athleteFirst}
        </div>
      </div>
    );
  } else if (hasWebsite) {
    // Priority 2: club website
    contactBlock = (
      <div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.55)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          Get in touch
        </div>
        <a
          href={club.website}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            padding: '10px 0', textAlign: 'center',
            background: '#c9a96e', color: '#0d1b2e',
            border: 'none', borderRadius: 2,
            fontSize: '0.75rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Visit {club.name} &rarr;
        </a>
      </div>
    );
  } else if (hasEmail) {
    // Priority 3: club email, no coach
    contactBlock = (
      <div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.55)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          Contact the club
        </div>
        <a
          href={`mailto:${club.contact_email}?subject=${subject}`}
          style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            padding: '10px 0', textAlign: 'center',
            background: '#c9a96e', color: '#0d1b2e',
            border: 'none', borderRadius: 2,
            fontSize: '0.75rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Email {club.contact_email}
        </a>
      </div>
    );
  } else {
    // Priority 4: whatever info exists
    const clubLocation = [club?.city, club?.state, club?.country].filter(Boolean).join(', ');
    contactBlock = (
      <div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(253,252,248,0.55)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          Contact this club
        </div>
        <div style={{ fontSize: '0.85rem', color: '#fdfcf8', marginBottom: 8 }}>
          {club?.name ?? 'Club'}
          {clubLocation ? ` — ${clubLocation}` : ''}
        </div>
        {hasPhone && (
          <a
            href={`tel:${club.phone}`}
            style={{
              display: 'block', width: '100%', boxSizing: 'border-box',
              padding: '10px 0', textAlign: 'center',
              background: '#c9a96e', color: '#0d1b2e',
              border: 'none', borderRadius: 2,
              fontSize: '0.75rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Call {club.phone}
          </a>
        )}
        {!hasPhone && (
          <div style={{ fontSize: '0.8rem', color: 'rgba(253,252,248,0.45)', fontStyle: 'italic' }}>
            Contact {club?.name ?? 'this club'} directly to reach {athleteFirst}.
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(13,27,46,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#142236',
          border: '1px solid rgba(201,169,110,0.25)',
          borderRadius: 4,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 400,
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: 'none',
            color: 'rgba(253,252,248,0.4)', fontSize: '1.2rem',
            cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit',
          }}
        >
          &times;
        </button>

        {/* Athlete name */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.14em', color: '#c9a96e', textTransform: 'uppercase', marginBottom: 6 }}>
            Request try-out
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 300, color: '#fdfcf8' }}>
            {lastInitial(athlete.name)}
          </div>
          {club?.name && (
            <div style={{ fontSize: '0.75rem', color: 'rgba(253,252,248,0.45)', marginTop: 2 }}>
              {club.name}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid rgba(201,169,110,0.12)', paddingTop: 20 }}>
          {contactBlock}
        </div>
      </div>
    </div>
  );
}
