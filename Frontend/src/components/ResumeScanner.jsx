import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./resume-scanner.scss";

const BEAM_SECONDS = 3.2;
const STEP_SECONDS = 5.5;

const ANALYSIS_STEPS = [
  "Reading your resume",
  "Extracting skills & experience",
  "Matching against the role",
  "Finding your skill gaps",
  "Building your interview plan",
];

// Resume skeleton, positioned in % of the page: [top, left, width, kind]
const LINES = [
  [7, 28, 40, "title"], [13.5, 28, 28, "sub"],
  [26, 8, 24, "head"], [31, 8, 80], [35.5, 8, 70], [40, 8, 76],
  [48, 8, 28, "head"], [53, 8, 82], [57.5, 8, 64], [62, 8, 78], [66.5, 8, 56],
  [74, 8, 20, "head"],
  [79, 8, 14, "pill"], [79, 25, 12, "pill"], [79, 40, 17, "pill"], [79, 60, 11, "pill"],
  [87, 8, 72], [91.5, 8, 50],
];

// Category labels that rise out of the page as the beam passes them
const TAGS = [
  { label: "Skills", x: 76, y: 33 },
  { label: "Experience", x: 24, y: 55 },
  { label: "Impact", x: 70, y: 64 },
  { label: "Education", x: 30, y: 88 },
];

const PARTICLES = [[18, 40], [62, 28], [44, 70], [82, 58], [30, 22], [56, 90]];

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

const ResumeScanner = ({
  title = <>Analysing your <em>resume</em></>,
  steps = ANALYSIS_STEPS,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Full-screen takeover: stop the page underneath from scrolling
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const activeStep = steps ? Math.min(Math.floor(elapsed / STEP_SECONDS), steps.length - 1) : 0;
  const progress = steps ? ((activeStep + Math.min((elapsed % STEP_SECONDS) / STEP_SECONDS, 0.9)) / steps.length) * 100 : 0;

  // Rendered into <body> so page layout styles can't pull it out of full-screen
  return createPortal(
    <main className="rs" style={{ "--beam": `${BEAM_SECONDS}s` }}>
      <div className="rs__glow" aria-hidden="true" />

      <div className="rs__scene" aria-hidden="true">
        <div className="rs__stage">
          <span className="rs__floor" />
          <span className="rs__shadow" />
          <span className="rs__page rs__page--back" />
          <span className="rs__page rs__page--mid" />

          <div className="rs__doc">
            <span className="rs__avatar" />
            {LINES.map(([top, left, width, kind], i) => (
              <span
                key={i}
                className={`rs__line${kind ? ` rs__line--${kind}` : ""}`}
                style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, "--y": top / 100 }}
              />
            ))}
            <span className="rs__beam" />
          </div>

          {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={`rs__corner rs__corner--${c}`} />)}

          <span className="rs__head" />

          {PARTICLES.map(([x, y], i) => (
            <span key={i} className="rs__particle" style={{ left: `${x}%`, top: `${y}%`, "--d": `${i * 0.55}s` }} />
          ))}

          {TAGS.map((tag, i) => (
            <span
              key={tag.label}
              className="rs__tag"
              style={{ left: `${tag.x}%`, top: `${tag.y}%`, "--d": `${(tag.y / 100) * BEAM_SECONDS + (i % 2) * BEAM_SECONDS}s` }}
            >
              <span className="rs__tag-dot" />
              <span className="rs__tag-stem" />
              <span className="rs__tag-chip">{tag.label}</span>
            </span>
          ))}
        </div>
      </div>

      <section className="rs__panel" role="status" aria-live="polite">
        <h1 className="rs__title">{title}</h1>

        {steps && (
          <>
            <ol className="rs__steps">
              {steps.map((label, i) => {
                const state = i < activeStep ? "done" : i === activeStep ? "active" : "pending";
                return (
                  <li key={label} className={`rs__step rs__step--${state}`}>
                    <span className="rs__step-icon">{state === "done" ? <Check /> : null}</span>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ol>
            <div className="rs__progress"><span style={{ width: `${progress}%` }} /></div>
          </>
        )}

        <p className="rs__time">
          <span>{elapsed}s elapsed</span>
          {steps && <span>Usually about 30 seconds</span>}
        </p>
      </section>
    </main>,
    document.body,
  );
};

export default ResumeScanner;
