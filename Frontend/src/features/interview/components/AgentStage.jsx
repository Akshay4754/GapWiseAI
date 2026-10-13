import React from "react";
import { AGENTS, getAgentState } from "./agentTeam.jsx";

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

const Check = () => <svg {...svgProps} strokeWidth={3}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;

const STATE_LABELS = { working: "Working", done: "Done", waiting: "Up next", skipped: "Not needed" };
// A run that stopped early never reached the agents still waiting
const getStateLabel = (state, mode) => (state === "waiting" && mode !== "running" ? "Not reached" : STATE_LABELS[state]);

const HEADINGS = {
  idle: <>Meet the <em>team</em></>,
  running: <>The agents are <em>working</em></>,
  awaiting_approval: <>Ready for <em>your approval</em></>,
  approved: <>Edits <em>applied</em></>,
  completed: <>Run <em>complete</em></>,
  failed: <>The run <em>stopped</em></>,
};

/**
 * The five agents as a pipeline. Before a run it plays a looping preview; during
 * a run the active agent lifts, shows the tool it just called, and a pulse
 * travels along the rail every time the work is handed on.
 */
const AgentStage = ({ run, booting = false }) => {
  const mode = run ? run.status : "idle";
  const states = AGENTS.map((agent) => getAgentState(agent, run));
  const activeIndex = states.indexOf("working");
  const reach = run ? Math.max(0, activeIndex, states.lastIndexOf("done")) : 0;
  const lastTool = mode === "running" ? [...run.steps].reverse().find((step) => step.tool) : null;

  return (
    <section
      className={`rp-card ao-stage ao-stage--${mode}${booting ? " is-booting" : ""}`}
      style={{ "--pos": activeIndex >= 0 ? activeIndex : reach, "--reach": reach }}
    >
      <div className="ao-stage__head">
        <h2>{HEADINGS[mode]}</h2>
        {run ? <p className="ao-stage__goal">Goal: {run.goal}</p> : <p className="ao-stage__goal">Each agent has its own job and its own tools.</p>}
      </div>

      <div className={`ao-track${run ? "" : " is-demo"}`}>
        <div className="ao-track__rail" aria-hidden="true">
          <span className="ao-track__fill" />
          <span className="ao-track__pulse" />
        </div>

        <ol className="ao-track__nodes">
          {AGENTS.map((agent, i) => {
            const state = states[i];
            const calls = run ? run.steps.filter((step) => step.agent === agent.key && step.tool).length : 0;
            const showTool = state === "working" && lastTool?.agent === agent.key;

            return (
              <li key={agent.key} className={`ao-node ao-node--${state}`} style={{ "--i": i }}>
                {showTool && (
                  // Re-keyed on every step so each new tool call pops in
                  <span className="ao-node__chip" key={run.steps.length}>{lastTool.tool}</span>
                )}
                <span className="ao-node__tile">
                  <span className="ao-node__halo" />
                  <span className="ao-node__halo" />
                  {agent.icon}
                  <span className="ao-node__badge"><Check /></span>
                </span>
                <strong className="ao-node__name">{agent.name}</strong>
                {run ? (
                  <span className="ao-node__state">
                    {getStateLabel(state, mode)}
                    {calls > 0 && <small> · {calls} {calls === 1 ? "call" : "calls"}</small>}
                  </span>
                ) : (
                  <span className="ao-node__role">{agent.role}</span>
                )}
                <span className="ao-node__tools">{agent.tools.join(" · ")}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

export default AgentStage;
