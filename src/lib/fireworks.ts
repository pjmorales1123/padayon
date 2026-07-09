const DEFAULT_MODEL = process.env.FIREWORKS_MODEL || "accounts/fireworks/models/gemma-3-27b-it";
const FALLBACK_MODEL = process.env.FIREWORKS_FALLBACK_MODEL || "accounts/fireworks/models/deepseek-v4-flash";
const REQUEST_TIMEOUT_MS = 25000;

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

async function callModel(model: string, messages: ChatMessage[], jsonMode = false, maxTokens = 1500) {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey || apiKey === 'placeholder') {
    console.warn('FIREWORKS_API_KEY not set, returning empty string for fallback');
    return '';
  }

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
    "https://api.fireworks.ai/inference/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    },
    REQUEST_TIMEOUT_MS
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`Fireworks API error for ${model}: ${res.status} ${text}`);
    throw new Error(`Fireworks API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function callFireworks(messages: ChatMessage[], jsonMode = false, maxTokens = 1500) {
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
