import React, { useRef, useState } from "react";
import "../style/home.scss";
import { useInterview } from "../hooks/useInterview.js";
import { askQuestionFromPdf } from "../services/interview.api.js";
import { useNavigate } from "react-router";

const Home = () => {
  const { loading, error, setError, generateReport, reports } = useInterview();
  const [jobDescription, setJobDescription] = useState("");
  const [selfDescription, setSelfDescription] = useState("");
  const [selectedResumeName, setSelectedResumeName] = useState("");
  const [selectedPdfName, setSelectedPdfName] = useState("");
  const [pdfQuestion, setPdfQuestion] = useState("");
  const [pdfAnswer, setPdfAnswer] = useState("");
  const [pdfSupportingPoints, setPdfSupportingPoints] = useState([]);
  const [pdfSources, setPdfSources] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const resumeInputRef = useRef();
  const pdfInputRef = useRef();

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

  const handleResumeChange = (event) => {
    const file = event.target.files?.[0];
    validatePdfFile(file, setSelectedResumeName, setError, event.target);
  };

  const handlePdfChange = (event) => {
    const file = event.target.files?.[0];
    validatePdfFile(file, setSelectedPdfName, setPdfError, event.target);
  };

  const handleGenerateReport = async () => {
    const resumeFile = resumeInputRef.current.files[0];

    if (!resumeFile && !selfDescription.trim()) {
      setError("Upload a resume or add a self-description to continue.");
      return;
    }

    try {
      const data = await generateReport({
        jobDescription,
        selfDescription,
        resumeFile,
      });
      if (data?._id) {
        navigate(`/interview/${data._id}`);
      }
    } catch {
      // Error state is handled by interview context and rendered below the action button.
    }
  };

  const handleAskFromPdf = async () => {
    const pdfFile = pdfInputRef.current.files[0];

    if (!pdfFile) {
      setPdfError("Upload a PDF document to ask questions from it.");
      return;
    }

    if (!pdfQuestion.trim()) {
      setPdfError("Enter a question for the uploaded PDF.");
      return;
    }

    setPdfLoading(true);
    setPdfError("");
    setPdfAnswer("");
    setPdfSupportingPoints([]);
    setPdfSources([]);

    try {
      const data = await askQuestionFromPdf({ pdfFile, question: pdfQuestion });
      setPdfAnswer(data?.answer || "No answer could be generated.");
      setPdfSupportingPoints(
        Array.isArray(data?.supportingPoints) ? data.supportingPoints : [],
      );
      setPdfSources(Array.isArray(data?.sources) ? data.sources : []);
    } catch (err) {
      setPdfError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to analyze the PDF.",
      );
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loading-screen__content loading-screen__content--analysis">
          <p>Analysing your resume...</p>
          <h1>Loading your interview plan...</h1>
        </div>
      </main>
    );
  }

  return (
    <div className="home-page">
      <header className="page-header">
        <div className="page-header__eyebrow">GapWise Workspace</div>
        <div className="page-header__content">
          <div className="page-header__copy">
            <h1>
              Build sharper interview plans and learn smarter from PDFs.
            </h1>
            <p>
              One private workspace for resume analysis, role alignment, and
              document-based answers powered by the same RAG flow.
            </p>
          </div>

          <div className="page-header__stats">
            <div className="workspace-pill">
              <span className="workspace-pill__label">Mode</span>
              <strong>Secure AI Prep</strong>
            </div>
            <div className="workspace-pill">
              <span className="workspace-pill__label">Inputs</span>
              <strong>Resume, Role, PDF</strong>
            </div>
            <div className="workspace-pill">
              <span className="workspace-pill__label">Output</span>
              <strong>Interview-Ready Report</strong>
            </div>
          </div>
        </div>
      </header>

      <div className="home-workspace">
        <section className="interview-card">
          <div className="workspace-section-heading">
            <div>
              <p className="workspace-section-heading__eyebrow">
                Interview Strategy
              </p>
              <h2>Create your main analysis</h2>
              <p className="workspace-section-heading__sub">
                Map the role, add your profile, and generate a focused preparation plan.
              </p>
            </div>
            <span className="badge badge--best">Primary Flow</span>
          </div>

          <div className="interview-card__body">
            <div className="interview-grid">
              <div className="panel panel--left">
                <div className="panel__header">
                  <span className="panel__step">01</span>
                  <div className="panel__title-group">
                    <h2>Target Job Description</h2>
                    <p>Paste the role brief you want to prepare for.</p>
                  </div>
                  <span className="badge badge--required">Required</span>
                </div>
                <textarea
                  value={jobDescription}
                  onChange={(e) => {
                    setJobDescription(e.target.value);
                  }}
                  className="panel__textarea"
                  placeholder={`Paste the full job description here...\ne.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'`}
                  maxLength={5000}
                />
                <div className="char-counter">
                  {jobDescription.length} / 5000 chars
                </div>
              </div>

              <div className="panel panel--right">
                <div className="panel__header">
                  <span className="panel__step">02</span>
                  <div className="panel__title-group">
                    <h2>Your Profile</h2>
                    <p>Upload your resume or write a quick self-summary.</p>
                  </div>
                </div>

                <div className="profile-stack">
                  <div className="upload-section">
                    <label className="section-label">
                      Upload Resume
                      <span className="badge badge--best">Best Results</span>
                    </label>
                    <label className="dropzone" htmlFor="resume">
                      <span className="dropzone__icon">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="16 16 12 12 8 16" />
                          <line x1="12" y1="12" x2="12" y2="21" />
                          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                        </svg>
                      </span>
                      <p className="dropzone__title">
                        Click to upload or drag &amp; drop
                      </p>
                      <p className="dropzone__subtitle">PDF only (Max 5MB)</p>
                      <input
                        ref={resumeInputRef}
                        onChange={handleResumeChange}
                        hidden
                        type="file"
                        id="resume"
                        name="resume"
                        accept=".pdf,application/pdf"
                      />
                    </label>
                    {selectedResumeName && (
                      <p className="dropzone__subtitle">
                        Selected: {selectedResumeName}
                      </p>
                    )}
                  </div>

                  <div className="or-divider">
                    <span>OR</span>
                  </div>

                  <div className="self-description">
                    <label className="section-label" htmlFor="selfDescription">
                      Quick Self-Description
                    </label>
                    <textarea
                      onChange={(e) => {
                        setSelfDescription(e.target.value);
                      }}
                      id="selfDescription"
                      name="selfDescription"
                      className="panel__textarea panel__textarea--short"
                      placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
                    />
                  </div>

                  <div className="info-box">
                    <span className="info-box__icon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line
                          x1="12"
                          y1="8"
                          x2="12"
                          y2="12"
                          stroke="#1a1f27"
                          strokeWidth="2"
                        />
                        <line
                          x1="12"
                          y1="16"
                          x2="12.01"
                          y2="16"
                          stroke="#1a1f27"
                          strokeWidth="2"
                        />
                      </svg>
                    </span>
                    <p>
                      Either a <strong>Resume</strong> or a{" "}
                      <strong>Self Description</strong> is required to generate a
                      personalized plan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="interview-card__footer">
            <span className="footer-info">
              AI-Powered Strategy Generation &bull; Approx 30s
            </span>
            <button onClick={handleGenerateReport} className="generate-btn">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
              Generate My Interview Strategy
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </section>

        <section className="pdf-assistant-card">
          <div className="pdf-assistant-card__header">
            <div>
              <p className="pdf-assistant-card__eyebrow">Ask From PDF</p>
              <h2>Ask From PDF</h2>
              <p className="pdf-assistant-card__sub">
                Upload a document and get answers grounded in its actual
                content.
              </p>
            </div>
            <span className="badge badge--best">RAG Assistant</span>
          </div>

          <div className="pdf-assistant-card__body">
            <div className="pdf-flow">
              <label className="upload-section upload-section--compact">
                <span className="section-label">Upload PDF</span>
                <label className="dropzone dropzone--compact" htmlFor="pdfFile">
                  <span className="dropzone__icon">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3v12" />
                      <path d="M7 8l5-5 5 5" />
                      <path d="M5 21h14" />
                    </svg>
                  </span>
                  <p className="dropzone__title">Drop a PDF or browse</p>
                  <p className="dropzone__subtitle">
                    Question answering over document context
                  </p>
                  <input
                    ref={pdfInputRef}
                    onChange={handlePdfChange}
                    hidden
                    type="file"
                    id="pdfFile"
                    name="pdfFile"
                    accept=".pdf,application/pdf"
                  />
                </label>
                {selectedPdfName && (
                  <p className="dropzone__subtitle">
                    Selected: {selectedPdfName}
                  </p>
                )}
              </label>

              <div className="self-description">
                <label className="section-label" htmlFor="pdfQuestion">
                  Your Question
                </label>
                <textarea
                  onChange={(e) => setPdfQuestion(e.target.value)}
                  id="pdfQuestion"
                  name="pdfQuestion"
                  className="panel__textarea panel__textarea--short pdf-question"
                  placeholder="Ask anything about the uploaded PDF, for example: What are the main deliverables?"
                />
              </div>
            </div>

            <button
              onClick={handleAskFromPdf}
              disabled={pdfLoading}
              className="generate-btn generate-btn--full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
              {pdfLoading ? "Analyzing PDF..." : "Ask from PDF"}
            </button>

            {pdfError && <p className="form-error">{pdfError}</p>}

            {(pdfAnswer ||
              pdfSupportingPoints.length > 0 ||
              pdfSources.length > 0) && (
              <div className="pdf-answer-card">
                <p className="pdf-answer-card__label">Answer</p>
                <p className="pdf-answer-card__text">{pdfAnswer}</p>

                {pdfSupportingPoints.length > 0 && (
                  <div className="pdf-answer-card__group">
                    <p className="pdf-answer-card__subheading">
                      Supporting points
                    </p>
                    <ul className="pdf-answer-card__list">
                      {pdfSupportingPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {pdfSources.length > 0 && (
                  <div className="pdf-answer-card__group">
                    <p className="pdf-answer-card__subheading">
                      Retrieved context
                    </p>
                    <div className="pdf-answer-card__sources">
                      {pdfSources.map((source, index) => (
                        <span key={index} className="source-pill">
                          {source.fileName || "Uploaded PDF"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {reports.length > 0 && (
        <section className="recent-reports">
          <h2>My Recent Interview Plans</h2>
          <ul className="reports-list">
            {reports.map((report) => (
              <li
                key={report._id}
                className="report-item"
                onClick={() => navigate(`/interview/${report._id}`)}
              >
                <h3>{report.title || "Untitled Position"}</h3>
                <p className="report-meta">
                  Generated on {new Date(report.createdAt).toLocaleDateString()}
                </p>
                <p
                  className={`match-score ${report.matchScore >= 80 ? "score--high" : report.matchScore >= 60 ? "score--mid" : "score--low"}`}
                >
                  Match Score: {report.matchScore}%
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="page-footer">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
        <a href="#">Help Center</a>
      </footer>
    </div>
  );
};

export default Home;
