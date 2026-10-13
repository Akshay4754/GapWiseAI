import React from "react";

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

// The five agents, in the order the work flows through them
export const AGENTS = [
  {
    key: "supervisor",
    name: "Planner",
    role: "Understands the job, plans the work and decides when it is done.",
    tools: ["analyze_job_description"],
    icon: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" /></svg>,
  },
  {
    key: "resume_analyst",
    name: "Resume Analyst",
    role: "Reads your resume and collects evidence for each requirement.",
    tools: ["extract_resume", "retrieve_resume_evidence"],
    icon: <svg {...svgProps}><path d="M11 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6l5 5v2.5" /><path d="M13 3v5h5" /><circle cx="16" cy="16.5" r="3" /><path d="m20.5 21-2.3-2.3" /></svg>,
  },
  {
    key: "job_match",
    name: "Job Match",
    role: "Compares the job's requirements with that evidence.",
    tools: ["analyze_job_description", "calculate_skill_gaps"],
    icon: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>,
  },
  {
    key: "optimizer",
    name: "Optimizer",
    role: "Rewrites lines using only facts already in your resume.",
    tools: ["apply_resume_edits"],
    icon: <svg {...svgProps}><path d="m4 20 1-4L16.4 4.6a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" /><path d="m14 7 3 3" /><path d="M19 15.5v3M17.5 17h3" /></svg>,
  },
  {
    key: "reviewer",
    name: "Reviewer",
    role: "Rejects anything your resume cannot back up.",
    tools: ["validate_resume_claims", "validate_resume_quality"],
    icon: <svg {...svgProps}><path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6l-7-3Z" /><path d="m9 12 2.2 2.2L15 10.5" /></svg>,
  },
];

export function getAgentState(agent, run) {
  if (!run) return "idle";

  const running = run.status === "running";
  const steps = run.plan.filter((step) => step.agent === agent.key);

  if (agent.key === "supervisor") {
    if (!running) return "done";
    // The Planner works before the plan exists and again once every step is done
    return run.plan.some((step) => step.status !== "done") ? "done" : "working";
  }
  if (steps.some((step) => step.status === "running")) return "working";
  if (steps.length > 0 && steps.every((step) => step.status === "done")) return "done";
  if (steps.length === 0 && run.plan.length > 0) return "skipped";
  return "waiting";
}
