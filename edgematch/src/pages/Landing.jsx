/**
 * Landing.jsx — Phase 5.1
 * Hero + How It Works + stats.
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const HOW_IT_WORKS = [
  {
    n: '1',
    title: 'Build your profile',
    desc: 'Tell us your discipline, level, height, location, and goals. Takes about 3 minutes.',
  },
  {
    n: '2',
    title: 'Get ranked matches',
    desc: 'Our algorithm scores compatibility across height, level, role, and location — then ranks your best fits.',
  },
  {
    n: '3',
    title: 'Schedule a tryout',
    desc: 'Request an on-ice tryout directly through the app. Confirm, log outcomes, and track your search.',
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <main className="landing">
      <section className="landing-hero">
        <h1>The right partner<br />changes everything.</h1>
        <p>
          EdgeMatch uses compatibility scoring to rank the best pairs and ice dance
          partners for you — by height, level, role, and location.
        </p>
        <div className="landing-ctas">
          {user ? (
            <>
              <Link to="/matches" className="btn-primary">View your matches</Link>
              <Link to="/tryouts" className="btn-secondary">Your tryouts</Link>
            </>
          ) : (
            <>
              <Link to="/signup" className="btn-primary">Find a partner</Link>
              <Link to="/admin" className="btn-secondary">I'm a coach</Link>
            </>
          )}
        </div>
      </section>

      <section className="landing-how">
        <h2>How it works</h2>
        <div className="how-steps">
          {HOW_IT_WORKS.map(s => (
            <div key={s.n} className="how-step">
              <span className="how-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-stats">
        <div><strong>207</strong><span>active skaters</span></div>
        <div><strong>12,331</strong><span>compatibility pairs scored</span></div>
        <div><strong>2</strong><span>disciplines: pairs &amp; ice dance</span></div>
      </section>

      <section className="landing-footer-note">
        <p>
          Built for competitors at every level — Pre-Juvenile through Senior.
        </p>
      </section>
    </main>
  );
}
