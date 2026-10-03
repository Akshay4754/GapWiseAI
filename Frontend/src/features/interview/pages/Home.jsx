import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth.js";
import "../style/home.scss";
import BrandLogo from "../../../components/BrandLogo.jsx";
import ThemeToggle from "../../../components/ThemeToggle.jsx";
import { usePageTitle } from "../../../hooks/usePageTitle.js";

const Arrow = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 10h11m-5-5 5 5-5 5" />
  </svg>
);

const Check = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="m4 10 4 4 8-8" />
  </svg>
);

const Spark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
    <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
  </svg>
);

const ScoreVisual = () => (
  <div className="fv-card fv-score">
    <div className="fv-ring" style={{ "--p": 86 }}><span>86</span><small>match</small></div>
    <div className="fv-bars">
      <small>Strengths for this role</small>
      <i style={{ "--w": "88%" }} />
      <i style={{ "--w": "72%" }} />
      <i style={{ "--w": "54%" }} />
    </div>
    <span className="fv-chip"><Check /> 3 quick wins</span>
  </div>
);

const PlanVisual = () => (
  <div className="fv-card fv-plan">
    <div className="fv-day is-done"><span className="fv-node"><Check /></span><div><small>Day 1</small><strong>Refresh core concepts</strong></div></div>
    <div className="fv-day is-active"><span className="fv-node" /><div><small>Day 2</small><strong>Mock technical interview</strong><i /></div></div>
    <div className="fv-day"><span className="fv-node" /><div><small>Day 3</small><strong>Practice behavioral stories</strong></div></div>
  </div>
);

const features = [
  {
    number: "01",
    title: "Resume intelligence",
    text: "Get a clear match score and the skill gaps that matter most for the role you want next.",
    color: "mint",
    Visual: ScoreVisual,
  },
  {
    number: "02",
    title: "Your career roadmap",
    text: "Turn your strengths and gaps into a focused, day-by-day plan you can actually follow.",
    color: "lavender",
    Visual: PlanVisual,
  },
];

// Fades sections in as they scroll into view
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function ScoreRing() {
  return (
    <div className="score-ring" aria-label="Resume score 78 out of 100">
      <div>
        <strong>78</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  useReveal();
  usePageTitle("Gapwise — Your career, made clearer.");

  return (
    <main className="site-shell">
      <nav className="topbar">
        <BrandLogo />
        <div className="topbar-actions">
          <div className={`nav-links ${mobileOpen ? "is-open" : ""}`}>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)}>How it works</a>
            <a href="#tools" onClick={() => setMobileOpen(false)}>Features</a>
            {user ? (
              <Link className="nav-login" to="/workspace" onClick={() => setMobileOpen(false)}>Workspace</Link>
            ) : (
              <Link className="nav-login" to="/login" onClick={() => setMobileOpen(false)}>Log in</Link>
            )}
            {user ? (
              <Link className="button button-dark nav-cta" to="/workspace" onClick={() => setMobileOpen(false)}>Open workspace <Arrow /></Link>
            ) : (
              <Link className="button button-dark nav-cta" to="/register" onClick={() => setMobileOpen(false)}>Get started <Arrow /></Link>
            )}
          </div>
          <ThemeToggle />
          <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
         <h1>Your career,<br /><em>made clearer.</em></h1>
          <p className="hero-lede">Gapwise turns your resume into a roadmap. Get honest insights, build the right skills, and move toward work you&apos;re excited about.</p>
          <div className="hero-actions">
            <Link className="button button-dark button-large" to="/workspace">Analyze my resume <Arrow /></Link>
            <a className="text-link" href="#how-it-works">See how it works <Arrow /></a>
          </div>
          <div className="trust-row">
            <div className="avatar-stack"><span>AM</span><span>JR</span><span>SK</span><span>+9k</span></div>
            <p><strong>10,000+ job seekers</strong><br />are getting unstuck with Gapwise</p>
          </div>
        </div>
        <div className="hero-art" aria-label="Resume analysis preview">
          <div className="hero-glow" />
          <div className="blob blob-one" />
          <div className="blob blob-two" />
          <div className="orb orb-left" />
          <div className="orb orb-right" />
          <div className="hero-spark spark-one" aria-hidden="true" />
          <div className="hero-spark spark-two" aria-hidden="true" />
          <div className="hero-note note-top"><span className="note-icon mint-icon"><Check /></span><span><strong>Clear next steps</strong><small>Skills matched to your goals</small></span></div>
          <div className="resume-card">
            <div className="resume-card-top"><span>GAPWISE ANALYSIS</span><span className="mini-chip">AI powered</span></div>
            <div className="resume-profile"><div className="profile-photo">JD</div><div><strong>Jordan Davis</strong><span>Product designer</span></div><span className="match-badge">92% match</span></div>
            <div className="resume-line line-long" /><div className="resume-line line-medium" />
            <div className="resume-body"><div><small>Resume score</small><ScoreRing /></div><div className="skill-bars"><small>Skills that stand out</small><div><span>Product strategy</span><i style={{ "--bar": "94%" }} /></div><div><span>User research</span><i style={{ "--bar": "82%" }} /></div><div><span>Data storytelling</span><i style={{ "--bar": "68%" }} /></div></div></div>
            <div className="resume-footer"><span><b>3</b> strengths found</span><span><b>5</b> growth areas</span></div>
          </div>
          <div className="hero-note note-bottom"><span className="note-icon peach-icon"><Spark /></span><span><strong>Roadmap unlocked</strong><small>12 weeks to your next role</small></span></div>
          <div className="art-caption">Your potential,<br /><strong>in focus.</strong></div>
        </div>
      </section>

      <section className="logo-strip"><span>Trusted by curious minds at</span><strong>acme</strong><strong>northstar</strong><strong className="logo-serif">monday</strong><strong>Vercel</strong><strong className="logo-script">luma</strong></section>

      <section className="analyzer-section section-pad" id="analyzer">
        <div className="section-heading centered reveal"><h2>One upload.<br /><em>A clearer direction.</em></h2><p>See what&apos;s working, what&apos;s missing, and exactly where to focus next. Free forever, no credit card needed.</p></div>
        <div className="upload-panel reveal">
          <div className="upload-content">
            <span className="upload-icon"><Spark /></span>
            <h3>Drop your resume here</h3>
            <p>PDF only · Max 5MB</p>
            <Link className="button button-dark upload-button" to="/workspace">Generate my analysis <Arrow /></Link>
            <span className="demo-button"><Link to="/workspace">or open your workspace</Link></span>
          </div>
          <div className="upload-aside"><span className="aside-kicker">What you&apos;ll get</span><div><Check /> Match score for your target role</div><div><Check /> Skill gaps ranked by priority</div><div><Check /> Likely interview questions &amp; answers</div><div><Check /> A day-by-day preparation plan</div></div>
        </div>
      </section>

      <section className="feature-section section-pad" id="tools">
        <div className="section-heading reveal"><h2>Everything you need to<br /><em>move forward.</em></h2></div>
        <div className="feature-grid reveal">
          {features.map(({ number, title, text, color, Visual }) => (
            <article className={`feature-card ${color}`} key={number}>
              <span className="feature-number">{number}</span>
              <div className="feature-visual">{Visual()}</div>
              <h3>{title}</h3>
              <p>{text}</p>
              <Link to="/workspace">Explore tool <Arrow /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="roadmap-section section-pad" id="how-it-works">
        <div className="roadmap-copy reveal"><h2>Stop guessing.<br /><em>Start growing.</em></h2><p>Your roadmap is built from your experience, your goals, and the roles you&apos;re reaching for. Small steps, meaningful momentum.</p><Link className="button button-dark" to="/workspace">Build my roadmap <Arrow /></Link></div>
        <div className="roadmap-visual reveal"><div className="roadmap-header"><span>YOUR 12-WEEK ROADMAP</span><span className="live-pill"><i /> In progress</span></div><div className="roadmap-role"><div><small>Target role</small><strong>Senior Product Designer</strong></div><span className="progress-circle">42%</span></div><div className="roadmap-timeline"><div className="timeline-item done"><span>01</span><div><strong>Sharpen your story</strong><small>Resume &amp; portfolio foundation</small></div><Check /></div><div className="timeline-item active"><span>02</span><div><strong>Close your skill gaps</strong><small>Research methods · SQL basics</small></div><div className="timeline-bar"><i /></div></div><div className="timeline-item"><span>03</span><div><strong>Show your impact</strong><small>Build a case study that lands</small></div></div></div></div>
      </section>

      <section className="cta-band reveal">
        <div className="cta-band__copy">
         <h2>See where you stand<br /><em>in about 30 seconds.</em></h2>
        </div>
        <Link className="button button-light button-large" to="/workspace">Analyze my resume <Arrow /></Link>
      </section>

      <footer className="site-footer">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <BrandLogo />
            <p>Make your next move a good one.</p>
          </div>
          <nav className="site-footer__links" aria-label="Footer">
            <a href="#tools">Features</a>
            <a href="#how-it-works">How it works</a>
            <Link to="/login">Log in</Link>
            <Link to="/register">Get started</Link>
          </nav>
        </div>
        <small>© {new Date().getFullYear()} Gapwise. Built for your next chapter.</small>
      </footer>
    </main>
  );
}

export default Home;
