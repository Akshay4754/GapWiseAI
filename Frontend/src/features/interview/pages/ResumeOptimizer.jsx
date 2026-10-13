import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  approveAgentRun,
  exportAgentRunPdf,
  getAgentRun,
  getLatestAgentRun,
  startAgentRun,
} from "../services/agent.api";
import "../style/interview.scss";
import "../style/optimizer.scss";
import AgentStage from "../components/AgentStage.jsx";
import { AGENTS, getAgentState } from "../components/agentTeam.jsx";
import BrandLogo from "../../../components/BrandLogo.jsx";
import ResumeScanner from "../../../components/ResumeScanner.jsx";
import ThemeToggle from "../../../components/ThemeToggle.jsx";
import { usePageTitle } from "../../../hooks/usePageTitle.js";
import { prefersReducedMotion, withViewTransition } from "../../../utils/viewTransition.js";

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

const Icon = {
  Arrow: () => <svg {...svgProps}><path d="M19 12H5m5 5-5-5 5-5" /></svg>,
  Forward: () => <svg {...svgProps}><path d="M5 12h14m-5-5 5 5-5 5" /></svg>,
  Alert: () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></svg>,
  Check: () => <svg {...svgProps}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>,
  Cross: () => <svg {...svgProps}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  Play: () => <svg {...svgProps}><path d="M7 5.5v13l11-6.5-11-6.5Z" /></svg>,
  Download: () => <svg {...svgProps}><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5" /><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" /></svg>,
  Shield: () => <svg {...svgProps}><path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6l-7-3Z" /><path d="m9 12 2.2 2.2L15 10.5" /></svg>,
  Search: () => <svg {...svgProps}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>,
  Hand: () => <svg {...svgProps}><path d="M9 11.5V5.2a1.6 1.6 0 0 1 3.2 0V10m0-1.2a1.6 1.6 0 0 1 3.2 0V11m0-.8a1.6 1.6 0 0 1 3.1 0v4.3A6.5 6.5 0 0 1 12 21c-2.5 0-4-1-5.3-3L4.2 13.8a1.5 1.5 0 0 1 2.5-1.7L9 14.5" /></svg>,
  Chevron: () => <svg {...svgProps}><path d="m6 9 6 6 6-6" /></svg>,
};

const DEFAULT_GOAL = "Optimise my resume for this job.";
const GOAL_PRESETS = [
  { label: "Full optimisation", goal: DEFAULT_GOAL },
  { label: "Only my skill gaps", goal: "Only tell me my skill gaps for this job. Do not edit my resume." },
];
const POLL_INTERVAL_MS = 1500;

const ACTOR_NAMES = {
  ...Object.fromEntries(AGENTS.map((agent) => [agent.key, agent.name])),
  system: "System",
  user: "You",
};

const getErrorMessage = (err, fallback) => err?.response?.data?.message || fallback;

function useCountUp(target, duration = 1200) {
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

const formatElapsed = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const Ring = ({ value, suffix = "%", label }) => {
  const shown = useCountUp(value);
  return (
    <div className="ao-ring" role="img" aria-label={`${label} ${value}${suffix}`}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="ao-ring__track" cx="40" cy="40" r="34" />
        <circle className="ao-ring__value" cx="40" cy="40" r="34" pathLength="100" style={{ "--v": value }} />
      </svg>
      <span><b>{shown}<small>{suffix}</small></b></span>
    </div>
  );
};

const StartPanel = ({ goal, onGoalChange, onStart, starting, compact = false }) => (
  <section className={`rp-card ao-start${compact ? " ao-start--compact" : ""}`}>
    {!compact && (
      <div className="ao-start__promise">
        <h2>Built to stay <em>honest.</em></h2>
        <ul>
          <li>
            <span><Icon.Search /></span>
            <div><strong>Evidence first</strong><p>Every claim is traced to a line in your resume.</p></div>
          </li>
          <li>
            <span><Icon.Shield /></span>
            <div><strong>Gaps stay gaps</strong><p>Missing skills are reported, never written in.</p></div>
          </li>
          <li>
            <span><Icon.Hand /></span>
            <div><strong>You decide</strong><p>Nothing changes until you approve it.</p></div>
          </li>
        </ul>
      </div>
    )}

    <form
      className="ao-start__form"
      onSubmit={(event) => {
        event.preventDefault();
        onStart();
      }}
    >
      <h2>{compact ? <>Run the agents <em>again</em></> : <>Set the <em>goal.</em></>}</h2>
      <div className="ao-presets" role="group" aria-label="Goal presets">
        {GOAL_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={goal.trim() === preset.goal ? "is-active" : ""}
            onClick={() => onGoalChange(preset.goal)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label className="ao-start__label" htmlFor="agent-goal">What should the agents do?</label>
      <textarea
        id="agent-goal"
        value={goal}
        onChange={(event) => onGoalChange(event.target.value)}
        rows={2}
        maxLength={500}
        placeholder={DEFAULT_GOAL}
      />
      <div className="ao-start__foot">
        <p>The Planner reads this and decides which agents are needed.</p>
        <button type="submit" className="rp-btn rp-btn--primary rp-btn--download" disabled={starting}>
          {starting ? <span className="rp-spinner" /> : <Icon.Play />}
          {starting ? "Waking The Agents…" : compact ? "Run Again" : "Start The Agents"}
        </button>
      </div>
    </form>
  </section>
);

const Feed = ({ steps, live }) => {
  const listRef = useRef(null);

  // Keep the newest step in view while the agents work
  useEffect(() => {
    const list = listRef.current;
    if (live && list) list.scrollTo({ top: list.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [steps.length, live]);

  return (
    <ol className="ao-feed" ref={listRef} aria-live={live ? "polite" : undefined}>
      {steps.map((step, i) => (
        <li key={i} className={`ao-feed__item ao-feed__item--${step.type}`}>
          <span className="ao-feed__dot" />
          <div>
            <p><strong>{ACTOR_NAMES[step.agent] || step.agent}</strong> {step.summary}</p>
            <span className="ao-feed__meta">
              {step.tool && <code>{step.tool}</code>}
              {step.type === "fallback" && <em>Guardrail</em>}
            </span>
          </div>
        </li>
      ))}
      {live && (
        <li className="ao-feed__item ao-feed__item--pending">
          <span className="ao-feed__dot" />
          <span className="ao-typing" aria-label="The agents are working"><i /><i /><i /></span>
        </li>
      )}
    </ol>
  );
};

const LivePanel = ({ run }) => {
  const [now, setNow] = useState(() => Date.now());
  const calls = useCountUp(run.llmCalls, 500);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const active = AGENTS.find((agent) => getAgentState(agent, run) === "working") || AGENTS[0];
  const latest = run.steps[run.steps.length - 1];
  const elapsed = Math.max(0, Math.round((now - new Date(run.createdAt).getTime()) / 1000));

  return (
    <section className="ao-live">
      <div className="rp-card ao-card ao-now">
        <p className="ao-now__label">Working now</p>
        {/* Re-keyed so the panel animates each time the work changes hands */}
        <div className="ao-now__agent" key={active.key}>
          <span className="ao-now__icon">{active.icon}</span>
          <div>
            <h2>{active.name}</h2>
            <p>{active.role}</p>
          </div>
        </div>
        <p className="ao-now__action" key={run.steps.length}>{latest?.summary || "Getting ready…"}</p>
        <dl className="ao-now__stats">
          <div><dt>Elapsed</dt><dd>{formatElapsed(elapsed)}</dd></div>
          <div><dt>AI calls</dt><dd>{calls}</dd></div>
          <div><dt>Steps</dt><dd>{run.steps.length}</dd></div>
        </dl>
        <div className="ao-now__bar"><span /></div>
        <p className="ao-now__hint">A full run usually takes about a minute, longer when the AI service is busy. You can leave this page; the agents keep working.</p>
      </div>

      <div className="rp-card ao-card">
        <div className="ao-card__head">
          <h2>Live activity</h2>
          <span className="ao-live__badge"><i /> Live</span>
        </div>
        <Feed steps={run.steps} live />
      </div>
    </section>
  );
};

const SummaryCard = ({ run, offered, rejected }) => {
  const gaps = run.skillGaps?.missing.filter((gap) => gap.severity === "high").length ?? 0;
  const stats = [
    run.skillGaps && { label: "Skill coverage", value: `${run.skillGaps.matchScore}%` },
    { label: offered.length === 1 ? "Edit ready" : "Edits ready", value: offered.length },
    { label: rejected.length === 1 ? "Edit rejected" : "Edits rejected", value: rejected.length },
    run.skillGaps && { label: gaps === 1 ? "Required gap" : "Required gaps", value: gaps },
  ].filter(Boolean);

  return (
    <section className="rp-card ao-card ao-summary">
      <span className="ao-summary__seal" aria-hidden="true">
        <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" /><path d="m15 24.5 6 6 12.5-13" /></svg>
      </span>
      <div className="ao-summary__body">
        <h2>The Planner&apos;s <em>summary</em></h2>
        <p>{run.summary}</p>
      </div>
      <dl className="ao-summary__stats">
        {stats.map((stat, i) => (
          <div key={stat.label} style={{ "--i": i }}>
            <dd>{stat.value}</dd>
            <dt>{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
};

const MatchCard = ({ run }) => {
  const gaps = run.skillGaps;
  // Skills the candidate's work proves although the resume never writes the word
  const implied = gaps.implied || [];
  const named = [...gaps.matched, ...gaps.preferredMatched].filter((skill) => !implied.includes(skill));
  const requiredMissing = gaps.missing.filter((gap) => gap.severity === "high").length;
  const requiredTotal = gaps.matched.length + requiredMissing;

  return (
    <section className="rp-card ao-card ao-match">
      <div className="ao-match__score">
        <Ring value={gaps.matchScore} label="Skill coverage" />
        <div>
          <h2>Skill <em>coverage</em></h2>
          <p>
            {gaps.matched.length} of {requiredTotal} required skills for {run.jobAnalysis?.title || "this role"} are backed by your resume.
          </p>
        </div>
      </div>
      <div className="ao-match__lists">
        <div>
          <h3>Named on your resume <span>{named.length}</span></h3>
          <ul className="ao-chips">
            {named.map((skill, i) => <li key={skill} style={{ "--i": i }}>{skill}</li>)}
            {named.length === 0 && <li className="is-empty">Nothing matched yet</li>}
          </ul>
        </div>
        {implied.length > 0 && (
          <div>
            <h3>Proven, but never named <span>{implied.length}</span></h3>
            <ul className="ao-chips ao-chips--implied">
              {implied.map((skill, i) => <li key={skill} style={{ "--i": i }}>{skill}</li>)}
            </ul>
            <p className="ao-match__hint">Your work shows these, but the words are not on your resume, so a keyword filter would miss them.</p>
          </div>
        )}
        <div>
          <h3>Gaps to close <span>{gaps.missing.length}</span></h3>
          <ul className="ao-chips ao-chips--gap">
            {gaps.missing.map((gap, i) => (
              <li key={gap.skill} className={gap.severity === "high" ? "" : "is-minor"} style={{ "--i": i }}>
                {gap.skill}{gap.severity !== "high" && <small> nice to have</small>}
              </li>
            ))}
            {gaps.missing.length === 0 && <li className="is-empty">No gaps found</li>}
          </ul>
        </div>
      </div>
      {gaps.missing.length > 0 && (
        <p className="ao-note"><Icon.Shield /> Gaps are skills to learn. The agents never add them to your resume.</p>
      )}
      <p className="ao-match__explain">
        This counts the job&apos;s skills one by one against your resume. The match score on your report is an overall judgement of your profile, so the two numbers are not expected to be the same.
      </p>
    </section>
  );
};

const CLAIM_LABELS = {
  supported: "Every claim is in your resume",
  needs_review: "Inferred from your resume, confirmed by the Reviewer",
};

const EditCard = ({ edit, index, selectable, checked, onToggle }) => (
  <li className={`ao-edit ao-edit--${edit.status}${selectable && !checked ? " is-off" : ""}`} style={{ "--i": index }}>
    <div className="ao-edit__head">
      <span className="ao-edit__section">{edit.section || "Resume"}</span>
      {selectable ? (
        <label className="ao-switch">
          <input type="checkbox" checked={checked} onChange={() => onToggle(edit.id)} />
          <span className="ao-switch__track"><span className="ao-switch__thumb"><Icon.Check /></span></span>
          <span className="ao-switch__text">{checked ? "Using this edit" : "Skipped"}</span>
        </label>
      ) : (
        <span className="ao-edit__verdict">Rejected</span>
      )}
    </div>

    <div className="ao-edit__diff">
      {edit.original && <p className="ao-edit__before">{edit.original}</p>}
      <span className="ao-edit__arrow" aria-hidden="true"><Icon.Chevron /></span>
      <p className="ao-edit__after">{edit.replacement}</p>
    </div>

    <dl className="ao-edit__meta">
      {edit.status === "rejected" ? (
        <div className="is-rejected"><dt>Why not</dt><dd>{edit.reviewNote}</dd></div>
      ) : (
        <>
          <div><dt>Why</dt><dd>{edit.reason}</dd></div>
          {edit.evidence && <div><dt>Evidence</dt><dd>&ldquo;{edit.evidence}&rdquo;</dd></div>}
          <div><dt>Check</dt><dd>{CLAIM_LABELS[edit.claimStatus] || edit.reviewNote}</dd></div>
        </>
      )}
    </dl>
  </li>
);

const QualityCard = ({ quality, title }) => {
  const coverage = quality.keywordCoverage;
  return (
    <section className="rp-card ao-card ao-quality">
      <div className="ao-quality__score">
        <Ring value={quality.score} suffix="" label="Quality score" />
        <div>
          <h2>{title}</h2>
          <p>Rule-based checks on the edited resume.</p>
        </div>
      </div>

      <div className="ao-coverage">
        <div className="ao-coverage__row">
          <span>Job keywords covered</span>
          <strong>{coverage.percentBefore}% <Icon.Forward /> {coverage.percent}%</strong>
        </div>
        <div className="ao-coverage__bar" style={{ "--from": `${coverage.percentBefore}%`, "--to": `${coverage.percent}%` }}>
          <span className="ao-coverage__before" />
          <span className="ao-coverage__after" />
        </div>
      </div>

      <ul className="ao-checks">
        {quality.checks.map((check, i) => (
          <li key={check.name} className={check.passed ? "is-pass" : "is-fail"} style={{ "--i": i }}>
            <span className="ao-checks__mark">{check.passed ? <Icon.Check /> : <Icon.Cross />}</span>
            <div><strong>{check.name}</strong><p>{check.detail}</p></div>
          </li>
        ))}
      </ul>
    </section>
  );
};

const ResumeOptimizer = () => {
  const { interviewId } = useParams();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [selection, setSelection] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const finalRef = useRef(null);
  const showFinal = useRef(false);
  usePageTitle(run?.status === "running" ? "Agents working… · Gapwise" : "Resume optimiser · Gapwise");

  const runId = run?._id;
  const running = run?.status === "running";

  useEffect(() => {
    let cancelled = false;

    getLatestAgentRun(interviewId)
      .then((data) => {
        if (!cancelled) setRun(data.run);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, "Could not load the agent workspace."));
      })
      .finally(() => {
        if (!cancelled) withViewTransition(() => setLoading(false));
      });

    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  // After the user applies edits, bring the finished resume into view
  useEffect(() => {
    if (run?.status !== "approved" || !showFinal.current) return;
    showFinal.current = false;
    finalRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, [run]);

  // Follow a working run until it reaches a final status
  useEffect(() => {
    if (!runId || !running) return undefined;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const data = await getAgentRun(runId);
        if (cancelled) return;
        if (data.run.status === "running") {
          setRun(data.run);
        } else {
          withViewTransition(() => setRun(data.run));
          window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, "Lost contact with the agents. Retrying…"));
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runId, running]);

  const start = async () => {
    if (busy) return;
    setBusy("start");
    setError("");
    try {
      const data = await startAgentRun({ interviewReportId: interviewId, goal: goal.trim() || DEFAULT_GOAL });
      withViewTransition(() => {
        setRun(data.run);
        setSelection(null);
      });
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    } catch (err) {
      setError(getErrorMessage(err, "Could not start the agents."));
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return <ResumeScanner title={<>Opening the <em>agent workspace</em></>} steps={null} />;
  }

  const edits = run?.edits || [];
  const offered = edits.filter((edit) => ["accepted", "approved", "declined"].includes(edit.status));
  const rejected = edits.filter((edit) => edit.status === "rejected");
  // Until the user changes it, every edit the Reviewer accepted is switched on
  const selected = selection ?? offered.filter((edit) => edit.status !== "declined").map((edit) => edit.id);
  const approved = run?.status === "approved";
  const appliedIds = offered.filter((edit) => edit.status === "approved").map((edit) => edit.id);
  const selectionChanged = approved && selected.slice().sort().join() !== appliedIds.sort().join();
  const canExport = approved && !selectionChanged;

  const toggleEdit = (id) =>
    setSelection(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);

  const approve = async () => {
    if (busy) return;
    setBusy("approve");
    setError("");
    try {
      const data = await approveAgentRun(run._id, selected);
      showFinal.current = true;
      withViewTransition(() => {
        setRun(data.run);
        setSelection(null);
      });
    } catch (err) {
      setError(getErrorMessage(err, "Could not apply your edits."));
    } finally {
      setBusy("");
    }
  };

  const exportPdf = async () => {
    if (busy) return;
    setBusy("export");
    setError("");
    try {
      const data = await exportAgentRunPdf(run._id);
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `optimized_resume_${run._id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // The error body arrives as bytes, so there is no message to read
      setError("Could not export the resume PDF. Please try again.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="interview-page agent-page">
      <div className="report-ambient report-ambient--mint" aria-hidden="true" />
      <div className="report-ambient report-ambient--peach" aria-hidden="true" />

      <nav className="report-nav">
        <BrandLogo />
        <div className="report-nav__actions">
          <Link className="report-nav__back" to={`/interview/${interviewId}`}><Icon.Arrow /> Back to report</Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="ao-main">
        <header className={`ao-hero${run ? " is-compact" : ""}`}>
          <h1>Your resume, tuned by{" "}<br /><em>five AI agents.</em></h1>
          <p>They plan the work, gather evidence from your resume, find the gaps, propose edits and check every claim.</p>
        </header>

        {error && <p className="rp-error" role="alert"><Icon.Alert /> {error}</p>}

        <AgentStage run={run} booting={busy === "start"} />

        {!run && <StartPanel goal={goal} onGoalChange={setGoal} onStart={start} starting={busy === "start"} />}

        {running && <LivePanel run={run} />}

        {run && !running && (
          <>
            {run.status === "failed" && (
              <p className="rp-error" role="alert"><Icon.Alert /> {run.error || "The agents could not finish this run."}</p>
            )}

            {run.summary && <SummaryCard run={run} offered={offered} rejected={rejected} />}

            {approved && run.finalResume && (
              <section className="rp-card ao-card ao-final" ref={finalRef}>
                <div className="ao-card__head">
                  <h2>Your approved <em>resume</em></h2>
                  <span className="ao-meta">{appliedIds.length} {appliedIds.length === 1 ? "edit" : "edits"} applied</span>
                </div>
                <pre className="ao-paper">{run.finalResume}</pre>
              </section>
            )}

            {run.skillGaps && <MatchCard run={run} />}

            {offered.length > 0 && (
              <section className={`rp-card ao-card ao-proposals${busy === "approve" ? " is-applying" : ""}`}>
                <div className="ao-card__head">
                  <h2>Suggested <em>edits</em></h2>
                  <span className="ao-meta">{selected.length} of {offered.length} selected</span>
                </div>
                <p className="ao-lede">Each one passed the claim check and the Reviewer. Switch off any you don&apos;t want.</p>
                <ul className="ao-edits">
                  {offered.map((edit, i) => (
                    <EditCard key={edit.id} edit={edit} index={i} selectable checked={selected.includes(edit.id)} onToggle={toggleEdit} />
                  ))}
                </ul>
              </section>
            )}

            {rejected.length > 0 && (
              <details className="rp-card ao-card ao-fold">
                <summary>
                  <h2>{rejected.length} {rejected.length === 1 ? "edit was" : "edits were"} <em>rejected</em></h2>
                  <span className="ao-fold__toggle">Show why <Icon.Chevron /></span>
                </summary>
                <ul className="ao-edits">
                  {rejected.map((edit, i) => <EditCard key={edit.id} edit={edit} index={i} />)}
                </ul>
              </details>
            )}

            {(approved ? run.finalQuality : run.quality) && (
              <QualityCard
                quality={approved ? run.finalQuality : run.quality}
                title={approved ? <>Your final resume&apos;s <em>quality</em></> : <>Quality with <em>these edits</em></>}
              />
            )}

            <details className="rp-card ao-card ao-fold">
              <summary>
                <h2>How the agents <em>got here</em></h2>
                <span className="ao-fold__toggle">{run.steps.length} steps · {run.llmCalls} AI calls <Icon.Chevron /></span>
              </summary>
              <Feed steps={run.steps} />
            </details>

            <StartPanel compact goal={goal} onGoalChange={setGoal} onStart={start} starting={busy === "start"} />

            {offered.length > 0 && (
              <div className={`ao-bar${busy ? " is-busy" : ""}`}>
                <div className="ao-bar__text">
                  <strong>{canExport ? "Your resume is ready" : `${selected.length} of ${offered.length} edits selected`}</strong>
                  <span>{canExport ? "The PDF contains exactly the wording you approved." : "Only the selected edits are written into your resume."}</span>
                </div>
                {canExport ? (
                  <button type="button" className="rp-btn rp-btn--primary rp-btn--download" onClick={exportPdf} disabled={Boolean(busy)}>
                    {busy === "export" ? <span className="rp-spinner" /> : <Icon.Download />}
                    {busy === "export" ? "Preparing Your PDF…" : "Export Resume PDF"}
                  </button>
                ) : (
                  <button type="button" className="rp-btn rp-btn--primary rp-btn--download" onClick={approve} disabled={Boolean(busy)}>
                    {busy === "approve" ? <span className="rp-spinner" /> : <Icon.Check />}
                    {busy === "approve" ? "Applying Your Edits…" : `Apply ${selected.length} Selected ${selected.length === 1 ? "Edit" : "Edits"}`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ResumeOptimizer;
