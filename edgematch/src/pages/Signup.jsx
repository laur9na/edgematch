/**
 * Signup.jsx
 * Handles sign-up (redirects to wizard) and sign-in (redirects via onAuthStateChange).
 * Route guards in App.jsx handle all auth-based redirects — no Navigate needed here.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Signup() {
  const [mode, setMode]       = useState('signup');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  function goToWizard(e) {
    e.preventDefault();
    navigate('/profile/new');
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      // onAuthStateChange in AuthContext will update session + athlete.
      // PublicRoute will then redirect to /browse once profileComplete.
      // If profile is incomplete, OnboardingRoute will redirect to /profile/new.
      // No manual navigate() needed here.
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === 'signup') {
    return (
      <div className="auth-page">
        <h1>Find your perfect skating partner</h1>
        <p>Create a free profile and see who you match with.</p>
        <button className="btn-primary" onClick={goToWizard}>Create my profile</button>
        <p className="auth-switch">
          Already have an account?{' '}
          <button className="link-btn" onClick={() => setMode('signin')}>Sign in</button>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Sign in</h1>
      <form onSubmit={handleSignIn} autoComplete="on">
        <label>Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>
        <label>Password
          <input
            type="password"
            value={password}
            onChange={e => setPass(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">
        New here?{' '}
        <button className="link-btn" onClick={() => setMode('signup')}>Create a profile</button>
      </p>
    </div>
  );
}
