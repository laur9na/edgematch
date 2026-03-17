/**
 * Signup.jsx — Entry point that redirects to Profile wizard.
 * Also handles the "Sign in" flow for existing users.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Signup() {
  const [mode, setMode]   = useState('signup'); // 'signup' | 'signin'
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // New user → go to full profile wizard
  function goToWizard(e) {
    e.preventDefault();
    navigate('/profile/new');
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate('/matches');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'signup') {
    return (
      <div className="auth-page">
        <h1>Find your perfect skating partner</h1>
        <p>Create a free profile and see who you match with.</p>
        <button className="btn-primary" onClick={goToWizard}>Create my profile →</button>
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
      <form onSubmit={handleSignIn}>
        <label>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>Password
          <input type="password" value={password} onChange={e => setPass(e.target.value)} required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">
        New here?{' '}
        <button className="link-btn" onClick={() => setMode('signup')}>Create a profile</button>
      </p>
    </div>
  );
}
