import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AuthProvider } from './hooks/useAuth';
import Nav from './components/Nav';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import Spinner from './components/Spinner';
import ErrorPage from './components/ErrorPage';
import './index.css';

const Landing      = lazy(() => import('./pages/Landing'));
const Signup       = lazy(() => import('./pages/Signup'));
const Profile      = lazy(() => import('./pages/Profile'));
const Matches      = lazy(() => import('./pages/Matches'));
const Tryouts      = lazy(() => import('./pages/Tryouts'));
const Admin        = lazy(() => import('./pages/Admin'));
const About        = lazy(() => import('./pages/About'));
const SkaterProfile = lazy(() => import('./pages/SkaterProfile'));
const Browse       = lazy(() => import('./pages/Browse'));
const ClubPage     = lazy(() => import('./pages/ClubPage'));

const EB = ({ children }) => (
  <ErrorBoundary FallbackComponent={ErrorPage}>{children}</ErrorBoundary>
);

function AppRoutes() {
  return (
    <>
      <Nav />
      <Suspense fallback={<Spinner />}>
        <Routes>
          {/* Public — redirects logged-in users with complete profiles to /browse */}
          <Route path="/"       element={<PublicRoute><Landing /></PublicRoute>} />
          <Route path="/login"  element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/signin" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/about"  element={<EB><About /></EB>} />

          {/* Waitlist intake form — fully public, no session required */}
          <Route path="/profile/new" element={<EB><Profile /></EB>} />
          <Route path="/onboarding"  element={<EB><Profile /></EB>} />

          {/* Protected — needs session + complete profile */}
          <Route path="/profile"      element={<EB><ProtectedRoute><Profile /></ProtectedRoute></EB>} />
          <Route path="/browse"       element={<EB><ProtectedRoute><Browse /></ProtectedRoute></EB>} />
          <Route path="/clubs/:id"    element={<EB><ProtectedRoute><ClubPage /></ProtectedRoute></EB>} />
          <Route path="/matches"      element={<EB><ProtectedRoute><Matches /></ProtectedRoute></EB>} />
          <Route path="/matches/:id"  element={<EB><ProtectedRoute><SkaterProfile /></ProtectedRoute></EB>} />
          <Route path="/athletes/:id" element={<EB><ProtectedRoute><SkaterProfile /></ProtectedRoute></EB>} />
          <Route path="/tryouts"      element={<EB><ProtectedRoute><Tryouts /></ProtectedRoute></EB>} />
          <Route path="/admin"        element={<EB><ProtectedRoute><Admin /></ProtectedRoute></EB>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
