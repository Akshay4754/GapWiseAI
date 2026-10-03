import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useInterview } from "../hooks/useInterview.js";
import "../style/interview.scss";
import BrandLogo from "../../../components/BrandLogo.jsx";
import ResumeScanner from "../../../components/ResumeScanner.jsx";
import ThemeToggle from "../../../components/ThemeToggle.jsx";
import { usePageTitle } from "../../../hooks/usePageTitle.js";

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

const Icon = {
  Code: () => <svg {...svgProps}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>,
  Chat: () => <svg {...svgProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Map: () => <svg {...svgProps}><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14" /></svg>,
  Target: () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>,
  Bulb: () => <svg {...svgProps}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" /></svg>,
  Chevron: () => <svg {...svgProps}><path d="m6 9 6 6 6-6" /></svg>,
  Check: () => <svg {...svgProps}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>,
  Download: () => <svg {...svgProps}><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5" /><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" /></svg>,
  Arrow: () => <svg {...svgProps}><path d="M19 12H5m5 5-5-5 5-5" /></svg>,
  Alert: () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></svg>,
};

const TABS = [
  { id: "technical", label: "Technical", icon: Icon.Code, field: "technicalQuestions", unit: "questions" },
  { id: "behavioral", label: "Behavioral", icon: Icon.Chat, field: "behavioralQuestions", unit: "questions" },
  { id: "roadmap", label: "Roadmap", icon: Icon.Map, field: "preparationPlan", unit: "days" },
];

const SEVERITY = {
  high: { label: "High priority", level: 3, rank: 0 },
  medium: { label: "Medium", level: 2, rank: 1 },
  low: { label: "Low", level: 1, rank: 2 },
};

const scoreTier = (score) => {
  if (score >= 80) return { key: "high", label: "Strong match", note: "You're well aligned with this role. Sharpen the details and walk in confident." };
  if (score >= 60) return { key: "mid", label: "Promising match", note: "A solid foundation with a few gaps worth closing before the interview." };
  return { key: "low", label: "Needs focus", note: "There are key gaps to close. Your roadmap below shows exactly where to start." };
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useCountUp(target, duration = 1600) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

// 270° gauge with tick marks, a gradient arc and a glowing tip
const ScoreGauge = ({ score, tier }) => {
  const value = useCountUp(score);
  const r = 78;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const offset = arc * (1 - score / 100);
  const ticks = Array.from({ length: 41 }, (_, i) => {
    const angle = ((135 + i * 6.75) * Math.PI) / 180;
    const inner = i % 5 === 0 ? 92 : 95;
    return { x1: 100 + inner * Math.cos(angle), y1: 100 + inner * Math.sin(angle), x2: 100 + 99 * Math.cos(angle), y2: 100 + 99 * Math.sin(angle), major: i % 5 === 0, lit: i / 40 <= score / 100 };
  });

  return (
    <div className={`rp-gauge rp-gauge--${tier.key}`} role="img" aria-label={`Match score ${score} out of 100, ${tier.label}`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="rp-gauge-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" className="rp-gauge__stop-a" />
            <stop offset="100%" className="rp-gauge__stop-b" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <line key={i} {...{ x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2 }} className={`rp-gauge__tick${t.major ? " is-major" : ""}${t.lit ? " is-lit" : ""}`} style={{ "--i": i }} />
        ))}
        <circle className="rp-gauge__track" cx="100" cy="100" r={r} strokeDasharray={`${arc} ${c}`} />
        <circle
          className="rp-gauge__value"
          cx="100"
          cy="100"
          r={r}
          stroke="url(#rp-gauge-grad)"
          strokeDasharray={`${arc} ${c}`}
          style={{ "--arc": `${arc}px`, "--offset": `${offset}px` }}
        />
        <g className="rp-gauge__tip" style={{ "--angle": `${135 + 270 * (score / 100)}deg` }}>
          <circle cx={100 + r} cy="100" r="7" className="rp-gauge__tip-halo" />
          <circle cx={100 + r} cy="100" r="4" className="rp-gauge__tip-dot" />
        </g>
      </svg>
      <div className="rp-gauge__center">
        <span className="rp-gauge__value-text">{value}<small>%</small></span>
        <span className="rp-gauge__caption">Match score</span>
      </div>
    </div>
  );
};

const QuestionCard = ({ item, index }) => {
  const [open, setOpen] = useState(false);

  return (
    <article className={`rp-q${open ? " is-open" : ""}`} style={{ "--i": index }}>
      <button className="rp-q__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="rp-q__num">{String(index + 1).padStart(2, "0")}</span>
        <span className="rp-q__text">{item.question}</span>
        <span className="rp-q__chev"><Icon.Chevron /></span>
      </button>
      <div className="rp-q__body">
        <div className="rp-q__inner">
          <section className="rp-q__block rp-q__block--why">
            <h4><Icon.Target /> Why they ask this</h4>
            <p>{item.intention}</p>
          </section>
          <section className="rp-q__block rp-q__block--how">
            <h4><Icon.Bulb /> How to answer</h4>
            <p>{item.answer}</p>
          </section>
        </div>
      </div>
    </article>
  );
};

const RoadmapDay = ({ day, index, last }) => (
  <li className="rp-day" style={{ "--i": index }}>
    <div className="rp-day__rail">
      <span className="rp-day__node">{day.day}</span>
      {!last && <span className="rp-day__line" />}
    </div>
    <div className="rp-day__card">
      <p className="rp-day__eyebrow">Day {day.day}</p>
      <h3>{day.focus}</h3>
      <ul>
        {day.tasks.map((task, i) => (
          <li key={i}><span className="rp-day__check"><Icon.Check /></span>{task}</li>
        ))}
      </ul>
    </div>
  </li>
);

const Interview = () => {
  const [activeTab, setActiveTab] = useState("technical");
  const [downloadingResume, setDownloadingResume] = useState(false);
  const { report, loading, error, getResumePdf } = useInterview();
  const { interviewId } = useParams();
  usePageTitle(report?.title ? `${report.title} · Gapwise` : "Interview report · Gapwise");

  if (!loading && !report && error) {
    return (
      <div className="interview-page rp-state">
        <div className="rp-state__card">
          <span className="rp-state__icon"><Icon.Alert /></span>
          <h1>We couldn&apos;t open this report</h1>
          <p>{error}</p>
          <Link className="rp-btn rp-btn--primary" to="/workspace">Back to workspace</Link>
        </div>
      </div>
    );
  }

  if (loading || !report) {
    return <ResumeScanner title={<>Opening your <em>results</em></>} steps={null} />;
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(report.matchScore) || 0)));
  const tier = scoreTier(score);
  const gaps = [...(report.skillGaps || [])].sort((a, b) => (SEVERITY[a.severity]?.rank ?? 3) - (SEVERITY[b.severity]?.rank ?? 3));
  const highGaps = gaps.filter((g) => g.severity === "high").length;
  const created = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;
  const tab = TABS.find((t) => t.id === activeTab);
  const items = report[tab.field] || [];

  const stats = [
    { label: "Technical questions", value: report.technicalQuestions?.length || 0, icon: Icon.Code },
    { label: "Behavioral questions", value: report.behavioralQuestions?.length || 0, icon: Icon.Chat },
    { label: "Days in your plan", value: report.preparationPlan?.length || 0, icon: Icon.Map },
    { label: highGaps ? `Skill gaps · ${highGaps} high` : "Skill gaps", value: gaps.length, icon: Icon.Target },
  ];

  const downloadResume = async () => {
    setDownloadingResume(true);
    try {
      await getResumePdf(interviewId);
    } finally {
      setDownloadingResume(false);
    }
  };

  return (
    <div className="interview-page">
      <div className="report-ambient report-ambient--mint" aria-hidden="true" />
      <div className="report-ambient report-ambient--peach" aria-hidden="true" />

      <nav className="report-nav">
        <BrandLogo />
        <div className="report-nav__actions">
          <Link className="report-nav__back" to="/workspace"><Icon.Arrow /> Back to workspace</Link>
          <ThemeToggle />
        </div>
      </nav>

      <header className="rp-hero">
        <div className="rp-hero__copy">
          <h1>{report.title || "Interview strategy report"}</h1>
          <p className="rp-hero__sub">Your match, the gaps that matter, and a focused plan to close them.</p>
          {created && <p className="rp-hero__date">Generated on {created}</p>}
        </div>
        <button onClick={downloadResume} disabled={downloadingResume} className="rp-btn rp-btn--primary rp-btn--download">
          {downloadingResume ? <span className="rp-spinner" /> : <Icon.Download />}
          {downloadingResume ? "Preparing your PDF…" : "Download ATS-Friendly Resume"}
        </button>
      </header>

      {error && <p className="rp-error" role="alert"><Icon.Alert /> {error}</p>}

      <section className="rp-overview">
        <div className={`rp-card rp-score rp-score--${tier.key}`}>
          <ScoreGauge score={score} tier={tier} />
          <div className="rp-score__body">
            <span className="rp-tier">{tier.label}</span>
            <p className="rp-score__note">{tier.note}</p>
            <div className="rp-stats">
              {stats.map(({ label, value, icon }) => (
                <div className="rp-stat" key={label}>
                  <span className="rp-stat__icon">{icon()}</span>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rp-card rp-gaps">
          <div className="rp-card__head">
            <h2>Skill gaps</h2>
            <span className="rp-count">{gaps.length}</span>
          </div>
          {gaps.length ? (
            <ul className="rp-gaps__list">
              {gaps.map((gap, i) => {
                const sev = SEVERITY[gap.severity] || SEVERITY.low;
                return (
                  <li key={`${gap.skill}-${i}`} className={`rp-gap rp-gap--${gap.severity}`} style={{ "--i": i }}>
                    <span className="rp-gap__bars" aria-hidden="true">
                      {[1, 2, 3].map((n) => <span key={n} className={n <= sev.level ? "is-on" : ""} />)}
                    </span>
                    <span className="rp-gap__skill">{gap.skill}</span>
                    <span className="rp-gap__sev">{sev.label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rp-empty">No significant gaps detected for this role.</p>
          )}
        </div>
      </section>

      <section className="rp-card rp-content">
        <div className="rp-tabs" role="tablist" aria-label="Report sections">
          {TABS.map(({ id, label, icon, field }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              className={`rp-tab${activeTab === id ? " is-active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              {icon()}
              <span>{label}</span>
              <span className="rp-tab__count">{report[field]?.length || 0}</span>
            </button>
          ))}
        </div>

        <div className="rp-panel" key={activeTab} role="tabpanel">
          <div className="rp-panel__head">
            <h2>
              {activeTab === "technical" && "Technical questions"}
              {activeTab === "behavioral" && "Behavioral questions"}
              {activeTab === "roadmap" && "Your preparation roadmap"}
            </h2>
            <p>
              {activeTab === "roadmap"
                ? `A ${items.length}-day plan built around your gaps.`
                : `${items.length} ${tab.unit} — tap any one to see why it's asked and how to answer.`}
            </p>
          </div>

          {activeTab === "roadmap" ? (
            <ol className="rp-roadmap">
              {items.map((day, i) => <RoadmapDay key={day.day ?? i} day={day} index={i} last={i === items.length - 1} />)}
            </ol>
          ) : (
            <div className="rp-qlist">
              {items.map((q, i) => <QuestionCard key={i} item={q} index={i} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Interview;
