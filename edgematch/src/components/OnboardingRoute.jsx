/**
 * OnboardingRoute.jsx
 * For the profile wizard — needs a session but profile must be incomplete.
 * - Loading  → spinner
 * - No session → /login
 * - Session + already complete → /browse (already done)
 * - Session + incomplete → render children
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthSpinner from './AuthSpinner';

export default function OnboardingRoute({ children }) {
  const { session, profileComplete, loading } = useAuth();
  if (loading) return <AuthSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (profileComplete) return <Navigate to="/browse" replace />;
  return children;
}
