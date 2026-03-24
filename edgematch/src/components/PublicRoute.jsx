/**
 * PublicRoute.jsx
 * For pages that logged-in users should skip (landing, login, signup).
 * - Loading  → spinner
 * - Session exists → /browse (already logged in, profileComplete not required)
 * - Otherwise → render children
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthSpinner from './AuthSpinner';

export default function PublicRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <AuthSpinner />;
  if (session) return <Navigate to="/browse" replace />;
  return children;
}
