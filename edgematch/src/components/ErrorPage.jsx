export default function ErrorPage({ error, resetErrorBoundary }) {
  return (
    <main style={{
      background: '#0d1b2e', padding: '24px 28px',
      minHeight: 'calc(100vh - 52px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{
          fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.14em',
          color: '#c9a96e', textTransform: 'uppercase', marginBottom: 16,
        }}>
          Something went wrong
        </div>
        <p style={{
          color: 'rgba(253,252,248,0.65)', fontSize: '0.85rem',
          lineHeight: 1.7, marginBottom: 24,
        }}>
          {error?.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          onClick={resetErrorBoundary}
          style={{
            background: '#c9a96e', color: '#0d1b2e', border: 'none',
            padding: '10px 24px', borderRadius: 2, fontSize: '0.75rem',
            fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em',
            textTransform: 'uppercase', fontFamily: 'inherit',
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
