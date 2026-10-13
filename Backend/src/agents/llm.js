const { GoogleGenAI } = require("@google/genai");
const { zodToJsonSchema } = require("zod-to-json-schema");

const DEFAULT_AGENT_MODEL = "gemini-flash-lite-latest";
const DEFAULT_FALLBACK_MODELS = ["gemini-flash-latest", "gemini-3-flash-preview"];
const REQUEST_TIMEOUT_MS = 45000;
const MAX_ROUNDS = 3;
const MAX_QUOTA_WAIT_MS = 20000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getAiClient() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error(
      "GOOGLE_GENAI_API_KEY is missing. Add it to Backend/.env and restart the backend.",
    );
    error.code = "MISSING_AI_API_KEY";
    error.status = 500;
    throw error;
  }

  return new GoogleGenAI({ apiKey });
}

function getModels() {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return [
    ...new Set([
      process.env.GEMINI_AGENT_MODEL?.trim() || DEFAULT_AGENT_MODEL,
      ...(fallbacks.length > 0 ? fallbacks : DEFAULT_FALLBACK_MODELS),
    ]),
  ];
}

const isTimeoutError = (error) => error?.name === "AbortError" || error?.name === "TimeoutError";
const isRetryable = (error) => [404, 429, 503].includes(error?.status);

// Per-minute quota errors say "Please retry in 23.4s"; daily ones use hours and
// minutes and are not worth waiting for.
function getQuotaWaitMs(error) {
  const match = /retry in ([\d.]+)s/i.exec(String(error?.message || ""));
  return match ? Math.ceil(Number(match[1]) * 1000) : 0;
}

// One Gemini model is often out of quota (429) or answering 503 "high demand"
// while the others are fine, so each round walks the whole model list before
// waiting. A model that hangs is abandoned and not tried again in this call.
async function generateWithFallback({ contents, config }, usage) {
  const ai = getAiClient();
  const models = getModels();
  const timedOut = new Set();
  let lastError;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (round > 0) {
      const quotaWait = getQuotaWaitMs(lastError);
      await sleep(quotaWait > 0 && quotaWait <= MAX_QUOTA_WAIT_MS ? quotaWait : 1200 * round);
    }

    for (const model of models) {
      if (timedOut.has(model)) continue;

      try {
        if (usage) usage.llmCalls += 1;
        return await ai.models.generateContent({
          model,
          contents,
          config: { ...config, abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
        });
      } catch (error) {
        if (isTimeoutError(error)) {
          timedOut.add(model);
          lastError = new Error(`${model} did not answer within ${REQUEST_TIMEOUT_MS}ms.`);
          lastError.status = 503;
        } else if (isRetryable(error)) {
          lastError = error;
        } else {
          throw error;
        }

        console.warn(`[Agent LLM] ${model} unavailable (status ${lastError.status}), trying the next option.`);
      }
    }
  }

  throw lastError;
}

function toJsonSchema(schema) {
  const jsonSchema = zodToJsonSchema(schema);
  delete jsonSchema.$schema;
  return jsonSchema;
}

// LangChain tools carry a Zod schema; Gemini wants a function declaration.
function toFunctionDeclaration(tool) {
  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: toJsonSchema(tool.schema),
  };
}

/**
 * One reasoning turn of an agent. The model must answer with at least one
 * function call chosen from the tools it was given.
 */
async function callWithTools({ system, contents, tools, usage }) {
  const response = await generateWithFallback(
    {
      contents,
      config: {
        systemInstruction: system,
        temperature: 0.2,
        tools: [{ functionDeclarations: tools.map(toFunctionDeclaration) }],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: tools.map((tool) => tool.name),
          },
        },
      },
    },
    usage,
  );

  return {
    functionCalls: response.functionCalls || [],
    // Returned as-is so thought signatures survive into the next turn.
    content: response.candidates?.[0]?.content || { role: "model", parts: [] },
  };
}

/** A single structured-output call, validated against a Zod schema. */
async function generateJson({ system, prompt, schema, usage }) {
  const response = await generateWithFallback(
    {
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: zodToJsonSchema(schema),
      },
    },
    usage,
  );

  let value;
  try {
    value = JSON.parse(response.text || "");
  } catch {
    value = undefined;
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error("The AI returned an invalid response. Please retry.");
    error.code = "INVALID_AI_RESPONSE";
    error.status = 502;
    throw error;
  }

  return result.data;
}

module.exports = { callWithTools, generateJson };
