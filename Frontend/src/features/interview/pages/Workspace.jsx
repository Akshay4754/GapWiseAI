import React, { useRef, useState } from "react";
import "../style/workspace.scss";
import { useInterview } from "../hooks/useInterview.js";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth.js";
import BrandLogo from "../../../components/BrandLogo.jsx";
import ResumeScanner from "../../../components/ResumeScanner.jsx";
import ThemeToggle from "../../../components/ThemeToggle.jsx";
import { usePageTitle } from "../../../hooks/usePageTitle.js";

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

const Icon = {
  Upload: () => <svg {...svgProps}><path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>,
  Check: () => <svg {...svgProps}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>,
  Close: () => <svg {...svgProps}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  Clock: () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  Alert: () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></svg>,
  Arrow: () => <svg {...svgProps}><path d="M5 12h14m-5-5 5 5-5 5" /></svg>,
  Doc: () => <svg {...svgProps}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>,
};

// Same thresholds and wording as the results page
const scoreTier = (score) => {
  if (score >= 80) return { key: "high", label: "Strong match" };
  if (score >= 60) return { key: "mid", label: "Promising match" };
  return { key: "low", label: "Needs focus" };
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

const ReportRow = ({ report, index }) => {
  const score = Math.max(0, Math.min(100, Math.round(Number(report.matchScore) || 0)));
  const tier = scoreTier(score);

  return (
    <li style={{ "--i": index }}>
      <Link className={`rr-item rr-item--${tier.key}`} to={`/interview/${report._id}`}>
        <span className="rr-ring" style={{ "--p": score }} aria-label={`Match score ${score}%`}>
          <span>{score}</span>
        </span>
        <span className="rr-item__body">
          <strong>{report.title || "Untitled position"}</strong>
          <small>
            <span className="rr-item__tier">{tier.label}</span>
            {report.createdAt && <> · {formatDate(report.createdAt)}</>}
          </small>
        </span>
        <span className="rr-item__cta">View <Icon.Arrow /></span>
      </Link>
    </li>
  );
};

const StepBadge = ({ n, done }) => (
  <span className={`ab-step${done ? " is-done" : ""}`} aria-label={done ? `Step ${n} complete` : `Step ${n}`}>
    {done ? <Icon.Check /> : n}
  </span>
);

const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const Workspace = () => {
  const { error, setError, generateReport, reports, reportsLoaded } = useInterview();
  const [generating, setGenerating] = useState(false);
  const { user, handleLogout } = useAuth();
  usePageTitle(generating ? "Analysing your resume… · Gapwise" : "Workspace · Gapwise");
  const [jobDescription, setJobDescription] = useState("");
  const [selfDescription, setSelfDescription] = useState("");
  const [selectedResumeName, setSelectedResumeName] = useState("");
  const [resumeSize, setResumeSize] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const resumeInputRef = useRef();
  const jobLimit = 5000;
  const hasResume = Boolean(selectedResumeName);
  const hasContext = jobDescription.trim().length > 0;

  const navigate = useNavigate();

  const validatePdfFile = (file, setFileName, setLocalError, eventTarget) => {
    if (!file) {
      setFileName("");
      return false;
    }

    const isPdfName = file.name?.toLowerCase().endsWith(".pdf");
    if (!isPdfName) {
      setFileName("");
      setLocalError("Please upload a PDF file.");
      eventTarget.value = "";
      return false;
    }

    const maxFileSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      setFileName("");
      setLocalError("PDF file must be 5MB or smaller.");
      eventTarget.value = "";
      return false;
    }

    setLocalError("");
    setFileName(file.name);
    return true;
  };

  const acceptResume = (file, input) => {
    const ok = validatePdfFile(file, setSelectedResumeName, setError, input);
    setResumeSize(ok ? file.size : 0);
    return ok;
  };

  const handleResumeChange = (event) => {
    acceptResume(event.target.files?.[0], event.target);
  };

  const handleResumeDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const input = resumeInputRef.current;
    if (acceptResume(event.dataTransfer.files?.[0], input)) {
      input.files = event.dataTransfer.files;
    }
  };

  const clearResume = (event) => {
    event.preventDefault();
    resumeInputRef.current.value = "";
    setSelectedResumeName("");
    setResumeSize(0);
  };

  const handleGenerateReport = async () => {
    const resumeFile = resumeInputRef.current.files[0];

    if (!resumeFile && !selfDescription.trim()) {
      setError("Upload a resume or add a self-description to continue.");
      return;
    }

    setGenerating(true);
    try {
      const data = await generateReport({
        jobDescription,
        selfDescription,
        resumeFile,
      });
      if (data?._id) {
        navigate(`/interview/${data._id}`);
        return;
      }
    } catch {
      // Error state is handled by interview context and rendered above the action button.
    }
    setGenerating(false);
  };

  return (
    <div className="home-page">
      {generating && <ResumeScanner />}
      <nav className="workspace-nav">
        <BrandLogo />
        <div className="workspace-nav__links">
          <Link to="/">Back to site</Link>
          {user && (
            <span className="workspace-nav__user">{user.username}</span>
          )}
          <ThemeToggle />
          <button
            type="button"
            className="workspace-nav__logout"
            onClick={async () => {
              await handleLogout();
              navigate("/");
            }}
          >
            Log out
          </button>
        </div>
      </nav>

      <header className="page-header">
        <div className="page-header__content">
          <div className="page-header__copy">
            <h1>Make your next<br /><em>move count.</em></h1>
            <p>
              Upload your resume, map a target role, and get a focused interview plan built around your strengths.
            </p>
          </div>

          <ol className="workflow-strip" aria-label="How GapWise works">
            <li className="workflow-step">
              <span className="workflow-step__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5M9 13h6M9 17h4" />
                </svg>
              </span>
              <span className="workflow-step__text">
                <span className="workflow-step__label">01 · Inputs</span>
                <strong>Resume + role</strong>
              </span>
            </li>
            <li className="workflow-step">
              <span className="workflow-step__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                </svg>
              </span>
              <span className="workflow-step__text">
                <span className="workflow-step__label">02 · Mode</span>
                <strong>Career clarity</strong>
              </span>
            </li>
            <li className="workflow-step">
              <span className="workflow-step__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19h4l3-7 3 4 6-10" />
                  <path d="M16 6h4v4" />
                </svg>
              </span>
              <span className="workflow-step__text">
                <span className="workflow-step__label">03 · Output</span>
                <strong>Focused roadmap</strong>
              </span>
            </li>
          </ol>
        </div>
      </header>

      <div className="home-workspace home-workspace--single">
        <section className="analysis-builder">
          <div className="analysis-builder__upload">
            <div className="ab-head">
              <StepBadge n="01" done={hasResume} />
              <div>
                <h2>Start with your <em>resume.</em></h2>
              </div>
            </div>
            <p className="ab-lede">A PDF gives your analysis the strongest, most personal starting point.</p>

            <label
              className={`ab-drop${isDragging ? " is-dragging" : ""}${hasResume ? " has-file" : ""}`}
              htmlFor="resume"
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleResumeDrop}
            >
              <input ref={resumeInputRef} onChange={handleResumeChange} hidden type="file" id="resume" name="resume" accept=".pdf,application/pdf" />
              {hasResume ? (
                <span className="ab-file">
                  <span className="ab-file__icon" aria-hidden="true">PDF</span>
                  <span className="ab-file__meta">
                    <strong title={selectedResumeName}>{selectedResumeName}</strong>
                    <small><Icon.Check /> Ready · {formatSize(resumeSize)}</small>
                  </span>
                  <button type="button" className="ab-file__remove" onClick={clearResume} aria-label="Remove resume"><Icon.Close /></button>
                </span>
              ) : (
                <>
                  <span className="ab-drop__icon" aria-hidden="true"><Icon.Upload /></span>
                  <strong>{isDragging ? "Release to upload" : "Drag & drop your resume"}</strong>
                  <small>or <u>browse files</u></small>
                  <span className="ab-drop__chips"><span>PDF</span><span>Up to 5 MB</span></span>
                </>
              )}
            </label>

            <ul className="ab-checks">
              <li><Icon.Check /> Skills &amp; technologies matched to the role</li>
              <li><Icon.Check /> Experience depth and measurable impact</li>
              <li><Icon.Check /> Gaps turned into a day-by-day plan</li>
            </ul>
          </div>

          <div className="analysis-builder__details">
            <div className="ab-head">
              <StepBadge n="02" done={hasContext} />
              <div>
                <h2>Add a little <em>context.</em></h2>
              </div>
            </div>

            <label className="ab-field" htmlFor="jobDescription">
              <span className="ab-field__label">Target job description <b>Required</b></span>
              <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} id="jobDescription" placeholder="Paste the full job post — responsibilities, requirements, nice-to-haves…" maxLength={jobLimit} />
              <span className="ab-meter">
                <span className="ab-meter__bar"><span style={{ width: `${(jobDescription.length / jobLimit) * 100}%` }} /></span>
                <small>{jobDescription.length.toLocaleString()} / {jobLimit.toLocaleString()}</small>
              </span>
            </label>

            <label className="ab-field" htmlFor="selfDescription">
              <span className="ab-field__label">About you <i>Optional</i></span>
              <textarea value={selfDescription} onChange={(e) => setSelfDescription(e.target.value)} id="selfDescription" placeholder="Your strengths, recent wins, and what you want next…" />
            </label>

            {error && <p className="ab-error" role="alert"><Icon.Alert /> {error}</p>}

            <div className="ab-footer">
              <p><Icon.Clock /> Your personalised plan is ready in about 30 seconds.</p>
              <button onClick={handleGenerateReport} className="ab-submit">
                Generate my analysis <Icon.Arrow />
              </button>
            </div>
          </div>
        </section>

      </div>

      <section className="rr">
        <div className="rr__head">
          <h2>Your interview plans</h2>
          {reportsLoaded && reports.length > 0 && <span className="rr__count">{reports.length}</span>}
        </div>

        {!reportsLoaded ? (
          <ul className="rr__list" aria-busy="true" aria-label="Loading your plans">
            {[0, 1, 2].map((i) => (
              <li key={i} className="rr-skeleton">
                <span className="rr-skeleton__ring" />
                <span className="rr-skeleton__lines"><i /><i /></span>
              </li>
            ))}
          </ul>
        ) : reports.length === 0 ? (
          <div className="rr-empty">
            <span className="rr-empty__icon"><Icon.Doc /></span>
            <div>
              <strong>No plans yet</strong>
              <p>Your first analysis will show up here, ready to revisit before every interview.</p>
            </div>
          </div>
        ) : (
          <ul className="rr__list">
            {reports.map((report, i) => <ReportRow key={report._id} report={report} index={i} />)}
          </ul>
        )}
      </section>

    </div>
  );
};

export default Workspace;
