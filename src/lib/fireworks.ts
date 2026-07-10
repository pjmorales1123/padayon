const DEFAULT_MODEL = process.env.FIREWORKS_MODEL || "accounts/fireworks/models/deepseek-v4-flash";
const FALLBACK_MODEL = process.env.FIREWORKS_FALLBACK_MODEL || "accounts/fireworks/models/kimi-k2p5";
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

export type ModelPreference = "auto" | "gemma-3" | "gemma-4";

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
  if (preference === "gemma-4") {
    return {
      endpoint: GEMMA_4_ENDPOINT || "https://api.fireworks.ai/inference/v1/chat/completions",
      modelName: GEMMA_4_DEPLOYMENT || GEMMA_4_MODEL_NAME,
    };
  }
  return {
    endpoint: GEMMA_3_ENDPOINT || "https://api.fireworks.ai/inference/v1/chat/completions",
    modelName: GEMMA_3_DEPLOYMENT || GEMMA_3_MODEL_NAME,
  };
}

async function callGemma(preference: "gemma-3" | "gemma-4", messages: ChatMessage[], jsonMode = false, maxTokens = 1500) {
  const { endpoint, modelName } = resolveGemmaConfig(preference);
  return await callModel(modelName, messages, jsonMode, maxTokens, endpoint, GEMMA_API_KEY);
}

export async function callFireworks(
  messages: ChatMessage[],
  jsonMode = false,
  maxTokens = 1500,
  preferredModel: ModelPreference = "auto"
) {
  if (preferredModel === "gemma-3" || preferredModel === "gemma-4") {
    try {
      console.log(`Trying Gemma model preference: ${preferredModel}`);
      return await callGemma(preferredModel, messages, jsonMode, maxTokens);
    } catch (err) {
      console.warn(`Gemma ${preferredModel} failed, falling back to serverless`, err);
      // Fall through to default/fallback serverless models
    }
  }

  try {
    return await callModel(DEFAULT_MODEL, messages, jsonMode, maxTokens);
  } catch (err) {
    console.warn(`Primary model ${DEFAULT_MODEL} failed, trying fallback ${FALLBACK_MODEL}`, err);
    try {
      return await callModel(FALLBACK_MODEL, messages, jsonMode, maxTokens);
    } catch (fallbackErr) {
      console.error(`Fallback model ${FALLBACK_MODEL} also failed`, fallbackErr);
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
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error("Fireworks vision call failed", err);
    return '';
  }
}
