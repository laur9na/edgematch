/**
 * AuthSpinner.jsx
 * Centered gold spinner on navy background.
 * Shown during auth state resolution to prevent flashing wrong page.
 */
export default function AuthSpinner() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1b2e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '3px solid rgba(201,169,110,0.2)',
        borderTopColor: '#c9a96e',
        animation: 'auth-spin 0.8s linear infinite',
      }} />
    </div>
  );
}
