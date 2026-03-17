import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Nav() {
  const { user, athlete, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">EdgeMatch</Link>
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/matches">Matches</Link>
            <Link to="/tryouts">Tryouts</Link>
            {athlete && <Link to="/profile">Profile</Link>}
            <button onClick={handleSignOut} className="nav-signout">Sign out</button>
          </>
        ) : (
          <>
            <Link to="/signup">Find a partner</Link>
            <Link to="/signin">Sign in</Link>
          </>
        )}
      </div>
    </nav>
  );
}
