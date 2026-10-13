// Every tool receives the run context through LangChain's `configurable`.
// It holds what the model must never choose for itself: the user id, the
// resume being worked on, the job description and the run's shared results.
function getContext(config) {
  const ctx = config?.configurable?.ctx;
  if (!ctx) {
    throw new Error("Tool was called without a run context.");
  }
  return ctx;
}

function withContext(ctx) {
  return { configurable: { ctx } };
}

module.exports = { getContext, withContext };
