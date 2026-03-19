import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Nav from './components/Nav';
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

// Guard: redirect to /signup if not authenticated
function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading…</div>;
  if (!user) return <Navigate to="/signup" replace />;
  return children;
}

function AppRoutes() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/"           element={<Landing />} />
        <Route path="/signup"     element={<Signup />} />
        <Route path="/signin"     element={<Signup />} />
        <Route path="/profile/new" element={<Profile />} />
        <Route path="/profile"    element={<Protected><Profile /></Protected>} />
        <Route path="/matches"    element={<Protected><Matches /></Protected>} />
        <Route path="/matches/:id"   element={<Protected><SkaterProfile /></Protected>} />
        <Route path="/athletes/:id"  element={<Protected><SkaterProfile /></Protected>} />
        <Route path="/tryouts"    element={<Protected><Tryouts /></Protected>} />
        <Route path="/about"      element={<About />} />
        <Route path="/browse"     element={<Browse />} />
        <Route path="/clubs/:id"  element={<ClubPage />} />
        <Route path="/admin"      element={<Admin />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
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
