/**
 * Signup.jsx Entry point that redirects to Profile wizard.
 * Also handles the "Sign in" flow for existing users.
 *
 * Session persistence: Supabase stores the session in localStorage by default,
 * so users stay signed in across page reloads/restarts without re-entering
 * credentials. The browser's password manager / OS keychain can save
 * email+password via the standard autocomplete="current-password" attribute.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function Signup() {
  const [mode, setMode]     = useState('signup'); // 'signup' | 'signin'
  const [email, setEmail]   = useState('');
  const [password, setPass] = useState('');
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(false);
  const { user, athlete, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();

  // Already signed in with a profile → skip this page entirely
  if (!authLoading && user && athlete) return <Navigate to="/matches" replace />;
  // Signed in but no profile yet → go finish the wizard
  if (!authLoading && user && !athlete) return <Navigate to="/profile/new" replace />;

  function goToWizard(e) {
    e.preventDefault();
    navigate('/profile/new');
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // signIn() returns { user, session } directly (not wrapped in { data })
      const signInData = await signIn(email, password);
      // If the auth user has no athlete row yet (prior signup failed mid-way),
      // send them to the profile wizard rather than the empty matches page.
      const { data: athleteRow } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', signInData.user.id)
        .maybeSingle();
      navigate(athleteRow ? '/matches' : '/profile/new');
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
      {/* autocomplete attributes let browser/OS keychain offer to save credentials */}
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
