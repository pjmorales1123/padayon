/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx === -1 || line.startsWith("#")) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
}

const apiKey = process.env.FIREWORKS_API_KEY;
const deployment = process.env.GEMMA_4_DEPLOYMENT;

if (!apiKey || !deployment) {
  console.error("Set FIREWORKS_API_KEY and GEMMA_4_DEPLOYMENT in .env.local");
  process.exit(1);
}

const action = process.argv[2];
const maxReplicas = action === "up" ? 1 : action === "down" ? 0 : action === "status" ? -1 : null;
if (maxReplicas === null && action !== "status") {
  console.error("Usage: node scripts/gemma4-scale.js up|down|status");
  process.exit(1);
}

async function scale() {
  const res = await fetch(`https://api.fireworks.ai/v1/${deployment}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ minReplicaCount: 0, maxReplicaCount: maxReplicas }),
  });
  const data = await res.json();
  console.log(JSON.stringify({ state: data.state, desired: data.desiredReplicaCount, max: data.maxReplicaCount, replicas: data.replicaCount }, null, 2));
}

async function status() {
  const res = await fetch(`https://api.fireworks.ai/v1/${deployment}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json();
  console.log(JSON.stringify({ state: data.state, desired: data.desiredReplicaCount, max: data.maxReplicaCount, replicas: data.replicaCount, accelerator: data.acceleratorType, acceleratorCount: data.acceleratorCount }, null, 2));
}

(async () => {
  if (action === "status") {
    await status();
  } else {
    await scale();
  }
})();
