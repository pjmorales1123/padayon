// Warm up the Gemma 4 on-demand deployment before a demo to avoid cold-start latency.
// Run with: node scripts/warmup-gemma4.js

const deployment = process.env.GEMMA_4_DEPLOYMENT || "accounts/princejirehmorales-2/deployments/ymlz8joa";
const apiKey = process.env.GEMMA_API_KEY || process.env.FIREWORKS_API_KEY;
const modelName = process.env.GEMMA_4_MODEL_NAME || deployment;

async function warmup() {
  if (!apiKey || apiKey === "placeholder") {
    console.error("GEMMA_API_KEY or FIREWORKS_API_KEY must be set");
    process.exit(1);
  }

  const url = process.env.GEMMA_4_ENDPOINT || "https://api.fireworks.ai/inference/v1/chat/completions";
  const body = {
    model: modelName,
    messages: [{ role: "user", content: "Hello" }],
    max_tokens: 10,
  };

  console.log(`Warming up Gemma 4 deployment: ${deployment}`);
  console.log("This may take 1-3 minutes if the deployment is scaled to zero...");

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (!res.ok) {
      const text = await res.text();
      console.error(`Warmup failed after ${elapsed}s: ${res.status} ${text}`);
      process.exit(1);
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "";
    console.log(`Warmup succeeded in ${elapsed}s. Reply: ${reply.slice(0, 100)}`);
  } catch (err) {
    console.error("Warmup error:", err.message);
    process.exit(1);
  }
}

warmup();
