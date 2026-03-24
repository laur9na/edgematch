/**
 * ProtectedRoute.jsx
 * Requires session only; profileComplete is not enforced since the app is
 * waitlist-only and admin access must always work regardless of athlete data.
 * - Loading  → spinner
 * - No session → /login
 * - Session → render children
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthSpinner from './AuthSpinner';

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <AuthSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}
