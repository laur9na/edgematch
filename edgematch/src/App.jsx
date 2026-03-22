import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Nav from './components/Nav';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import OnboardingRoute from './components/OnboardingRoute';
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import Matches from './pages/Matches';
import Tryouts from './pages/Tryouts';
import Admin from './pages/Admin';
import About from './pages/About';
import SkaterProfile from './pages/SkaterProfile';
import Browse from './pages/Browse';
import ClubPage from './pages/ClubPage';
import './index.css';

function AppRoutes() {
  return (
    <>
      <Nav />
      <Routes>
        {/* Public — redirects logged-in users with complete profiles to /browse */}
        <Route path="/"        element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/login"   element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/signup"  element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/signin"  element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/about"   element={<About />} />

        {/* Onboarding — needs session, profile must be incomplete */}
        <Route path="/profile/new"  element={<OnboardingRoute><Profile /></OnboardingRoute>} />
        <Route path="/onboarding"   element={<OnboardingRoute><Profile /></OnboardingRoute>} />

        {/* Protected — needs session + complete profile */}
        <Route path="/profile"      element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/browse"       element={<ProtectedRoute><Browse /></ProtectedRoute>} />
        <Route path="/clubs/:id"    element={<ProtectedRoute><ClubPage /></ProtectedRoute>} />
        <Route path="/matches"      element={<ProtectedRoute><Matches /></ProtectedRoute>} />
        <Route path="/matches/:id"  element={<ProtectedRoute><SkaterProfile /></ProtectedRoute>} />
        <Route path="/athletes/:id" element={<ProtectedRoute><SkaterProfile /></ProtectedRoute>} />
        <Route path="/tryouts"      element={<ProtectedRoute><Tryouts /></ProtectedRoute>} />
        <Route path="/admin"        element={<ProtectedRoute><Admin /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
