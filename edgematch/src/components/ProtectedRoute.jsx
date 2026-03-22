/**
 * ProtectedRoute.jsx
 * Requires: session + profileComplete.
 * - Loading  → spinner
 * - No session → /login
 * - Session but profile incomplete → /profile/new (finish onboarding)
 * - Session + complete → render children
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthSpinner from './AuthSpinner';

export default function ProtectedRoute({ children }) {
  const { session, profileComplete, loading } = useAuth();
  if (loading) return <AuthSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profileComplete) return <Navigate to="/profile/new" replace />;
  return children;
}
