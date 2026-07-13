const DEFAULT_MODEL = process.env.FIREWORKS_MODEL || "accounts/fireworks/models/deepseek-v4-flash";
const FALLBACK_SERVERLESS_MODEL = "accounts/fireworks/models/deepseek-v4-flash";
const VISION_MODEL = process.env.FIREWORKS_VISION_MODEL || "accounts/fireworks/models/kimi-k2p6";
const REQUEST_TIMEOUT_MS = 60000;

// Gemma endpoints can be Fireworks on-demand deployments, AMD Cloud local endpoints, or any OpenAI-compatible URL.
const GEMMA_3_ENDPOINT = process.env.GEMMA_3_ENDPOINT || "";
const GEMMA_4_ENDPOINT = process.env.GEMMA_4_ENDPOINT || "";
const GEMMA_3_DEPLOYMENT = process.env.GEMMA_3_DEPLOYMENT || "";
const GEMMA_4_DEPLOYMENT = process.env.GEMMA_4_DEPLOYMENT || "";
const GEMMA_3_MODEL_NAME = process.env.GEMMA_3_MODEL_NAME || "accounts/fireworks/models/gemma-3-27b-it";
const GEMMA_4_MODEL_NAME = process.env.GEMMA_4_MODEL_NAME || "accounts/fireworks/models/gemma-4-31b-it";
const GEMMA_API_KEY = process.env.GEMMA_API_KEY || process.env.FIREWORKS_API_KEY || "";

export type ModelPreference = "auto" | "fallback" | "gemma-3" | "gemma-4";

export interface ModelRuntime {
  requested: ModelPreference;
  provider: "fireworks" | "gemma";
  model: string;
  fallback: boolean;
}

export type ModelRuntimeReporter = (runtime: ModelRuntime) => void;

interface ChatMessage {
  role: string;
  content: string;
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

async function callModel(model: string, messages: ChatMessage[], jsonMode = false, maxTokens = 1500, endpointUrl?: string, apiKey?: string) {
  const key = apiKey || process.env.FIREWORKS_API_KEY;
  if (!key || key === 'placeholder') {
    console.warn('API key not set, returning empty string for fallback');
    return '';
  }

  const url = endpointUrl || "https://api.fireworks.ai/inference/v1/chat/completions";

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    },
    REQUEST_TIMEOUT_MS
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`API error for ${model} @ ${url}: ${res.status} ${text}`);
    throw new Error(`API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function resolveGemmaConfig(preference: "gemma-3" | "gemma-4") {
  const isGemma4 = preference === "gemma-4";
  const deployment = isGemma4 ? GEMMA_4_DEPLOYMENT : GEMMA_3_DEPLOYMENT;
  const publicModel = isGemma4 ? GEMMA_4_MODEL_NAME : GEMMA_3_MODEL_NAME;
  const explicitEndpoint = isGemma4 ? GEMMA_4_ENDPOINT : GEMMA_3_ENDPOINT;

  // Fireworks deployments are served through the generic chat completions
  // endpoint with the deployment resource name as `model`.
  const deploymentMatch = deployment?.match(/^accounts\/([^/]+)\/deployments\/([^/]+)$/);
  if (deploymentMatch) {
    return {
      endpoint: explicitEndpoint || "https://api.fireworks.ai/inference/v1/chat/completions",
      modelName: deployment,
      fallbackModel: publicModel,
    };
  }

  return {
    endpoint: explicitEndpoint || "https://api.fireworks.ai/inference/v1/chat/completions",
    modelName: deployment || publicModel,
  };
}

async function callGemma(preference: "gemma-3" | "gemma-4", messages: ChatMessage[], jsonMode = false, maxTokens = 1500) {
  const { endpoint, modelName, fallbackModel } = resolveGemmaConfig(preference);
  try {
    return await callModel(modelName, messages, jsonMode, maxTokens, endpoint, GEMMA_API_KEY);
  } catch (err) {
    // If the deployment endpoint is broken/missing, fall back to the public model.
    if (fallbackModel) {
      console.warn(`Gemma deployment ${modelName} failed, falling back to public model ${fallbackModel}`, err);
      return await callModel(fallbackModel, messages, jsonMode, maxTokens, "https://api.fireworks.ai/inference/v1/chat/completions", GEMMA_API_KEY);
    }
    throw err;
  }
}

export async function callFireworks(
  messages: ChatMessage[],
  jsonMode = false,
  maxTokens = 1500,
  preferredModel: ModelPreference = "auto",
  reportRuntime?: ModelRuntimeReporter
) {
  // Fallback / auto always uses the fast Kimi serverless model.
  if (preferredModel === "fallback" || preferredModel === "auto") {
    try {
      const result = await callModel(FALLBACK_SERVERLESS_MODEL, messages, jsonMode, maxTokens);
      if (result && reportRuntime) {
        reportRuntime({ requested: preferredModel, provider: "fireworks", model: FALLBACK_SERVERLESS_MODEL, fallback: false });
      }
      return result;
    } catch (err) {
      console.warn(`Fallback model ${FALLBACK_SERVERLESS_MODEL} failed, trying default ${DEFAULT_MODEL}`, err);
      try {
        const result = await callModel(DEFAULT_MODEL, messages, jsonMode, maxTokens);
        if (result && reportRuntime) {
          reportRuntime({ requested: preferredModel, provider: "fireworks", model: DEFAULT_MODEL, fallback: true });
        }
        return result;
      } catch (fallbackErr) {
        console.error(`Default model ${DEFAULT_MODEL} also failed`, fallbackErr);
        return '';
      }
    }
  }

  let gemmaAttempted = false;

  if (preferredModel === "gemma-3" || preferredModel === "gemma-4") {
    try {
      console.log(`Trying Gemma model preference: ${preferredModel}`);
      const { modelName } = resolveGemmaConfig(preferredModel);
      const result = await callGemma(preferredModel, messages, jsonMode, maxTokens);
      if (result && reportRuntime) {
        reportRuntime({ requested: preferredModel, provider: "gemma", model: modelName, fallback: false });
      }
      return result;
    } catch (err) {
      gemmaAttempted = true;
      console.warn(`Gemma ${preferredModel} failed, falling back to ${FALLBACK_SERVERLESS_MODEL}`, err);
    }
  }

  try {
    const result = await callModel(FALLBACK_SERVERLESS_MODEL, messages, jsonMode, maxTokens);
    if (result && reportRuntime) {
      reportRuntime({ requested: preferredModel, provider: "fireworks", model: FALLBACK_SERVERLESS_MODEL, fallback: gemmaAttempted });
    }
    return result;
  } catch (err) {
    console.warn(`Fallback model ${FALLBACK_SERVERLESS_MODEL} failed, trying default ${DEFAULT_MODEL}`, err);
    try {
      const result = await callModel(DEFAULT_MODEL, messages, jsonMode, maxTokens);
      if (result && reportRuntime) {
        reportRuntime({ requested: preferredModel, provider: "fireworks", model: DEFAULT_MODEL, fallback: true });
      }
      return result;
    } catch (fallbackErr) {
      console.error(`Default model ${DEFAULT_MODEL} also failed`, fallbackErr);
      return '';
    }
  }
}

export async function callFireworksWithModel(model: string, messages: ChatMessage[], jsonMode = false, maxTokens = 1500) {
  try {
    return await callModel(model, messages, jsonMode, maxTokens);
  } catch (err) {
    console.error(`Model ${model} failed`, err);
    return '';
  }
}

const VISION_META_PATTERNS = [
  /^The user wants/i,
  /^I need to/i,
  /^I should/i,
  /^Let me /i,
  /^Wait[,.]?/i,
  /^Actually[,.]?/i,
  /^Looking at /i,
  /^Top (section|left|right)/i,
  /^Bottom /i,
  /^Left side:/i,
  /^Right side:/i,
  /^Left:/i,
  /^Right:/i,
  /^Then:/i,
  /^Then sections?/i,
  /^Hmm[,.]?/i,
  /^Line \d+:/i,
  /^I think /i,
  /^I will /i,
  /^I can /i,
  /^But /i,
  /^However,/i,
  /^So /i,
  /^Now,/i,
  /^First,/i,
  /^Next,/i,
  /^Finally,/i,
  /^In plain text/i,
  /^For the two-column/i,
  /^Since I need/i,
  /^Without knowing/i,
  /^I can't easily/i,
  /^Since the user/i,
  /^The raw OCR/i,
  /^We need to /i,
  /^From the raw OCR/i,
  /^The most complete/i,
  /^The actual text/i,
  /^Let me verify/i,
  /^Let me check/i,
  /^Let me re-examine/i,
  /^Let me also/i,
  /^Let me look/i,
  /^Let me assume/i,
  /^Let me just/i,
  /^One more check/i,
  /^But actually/i,
  /^Then (two columns|there|the sections|the descriptions)/i,
  /^Under (INTERNAL|EXTERNAL):/i,
];

function looksLikeVisionMeta(text: string): boolean {
  return VISION_META_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

function stripSurroundingQuotes(line: string): string {
  if (line.length > 2 && line.startsWith('"') && line.endsWith('"') && (line.match(/"/g) || []).length === 2) {
    return line.slice(1, -1);
  }
  return line;
}

function dedupeConsecutiveLines(lines: string[]): string[] {
  const deduped: string[] = [];
  for (const line of lines) {
    if (line === deduped[deduped.length - 1]) continue;
    deduped.push(line);
  }
  return deduped;
}

function extractNumberedList(rawText: string): string[] | null {
  const lines: string[] = [];
  for (const rawLine of rawText.split(/\r?\n/)) {
    const match = /^\s*\d+[\.)]\s+(.*)$/.exec(rawLine);
    if (!match) continue;
    const line = stripSurroundingQuotes(match[1].trim());
    if (line) lines.push(line);
  }
  return lines.length >= 3 ? lines : null;
}

function isVisionMetaLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (looksLikeVisionMeta(trimmed)) return true;
  // Drop model-added positional labels like Left: "..." Right: "..."
  if (/^(Left|Right):\s*["']?/i.test(trimmed)) return true;
  // Drop quoted observations that include positional commentary
  if (/^["'].*["']\s*\(.*(left|right|with|maybe|heading|title|centered|above|below)/i.test(trimmed)) {
    return true;
  }
  return false;
}

function cleanVisionOutput(rawText: string): string {
  // Prefer a numbered-list transcription when the model produces one.
  const numbered = extractNumberedList(rawText);
  if (numbered) {
    return dedupeConsecutiveLines(numbered).join("\n").trim();
  }

  // Fall back to stripping known meta commentary.
  const cleaned: string[] = [];
  for (const rawLine of rawText.split(/\r?\n/)) {
    if (isVisionMetaLine(rawLine)) continue;

    let line = rawLine.trim();
    if (!line) continue;

    line = stripSurroundingQuotes(line);
    line = line.replace(/^Line \d+:\s*["']?/i, "");

    cleaned.push(line);
  }

  return dedupeConsecutiveLines(cleaned).join("\n").trim();
}

export async function callFireworksVision(
  base64Image: string,
  prompt = "Transcribe any text in this image and describe what it shows. Be concise.",
  maxTokens = 800
): Promise<string> {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey || apiKey === 'placeholder') {
    console.warn('FIREWORKS_API_KEY not set, returning empty vision response');
    return '';
  }

  const mime = base64Image.startsWith("data:image/png") ? "image/png" : "image/jpeg";
  const url = base64Image.startsWith("data:") ? base64Image : `data:${mime};base64,${base64Image}`;

  const body = {
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url } },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  };

  try {
    const res = await fetchWithTimeout(
      "https://api.fireworks.ai/inference/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      REQUEST_TIMEOUT_MS
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`Fireworks vision API error: ${res.status} ${text}`);
      throw new Error(`Fireworks vision API error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    return cleanVisionOutput(raw);
  } catch (err) {
    console.error("Fireworks vision call failed", err);
    return '';
  }
}
