import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <main className="landing">
      <section className="landing-hero">
        <h1>The right partner<br />changes everything.</h1>
        <p>EdgeMatch uses compatibility scoring to rank the best pairs and ice dance partners for you — by height, level, role, and location.</p>
        <div className="landing-ctas">
          <Link to="/signup" className="btn-primary">Find a partner</Link>
          <Link to="/admin" className="btn-secondary">I'm a coach</Link>
        </div>
      </section>
      <section className="landing-stats">
        <div><strong>207</strong><span>active skaters</span></div>
        <div><strong>12,331</strong><span>compatibility pairs scored</span></div>
        <div><strong>2</strong><span>disciplines: pairs & ice dance</span></div>
      </section>
    </main>
  );
}
