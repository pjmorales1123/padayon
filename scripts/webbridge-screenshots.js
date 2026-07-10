/* eslint-disable */
const fs = require("fs");
const path = require("path");

const DAEMON = "http://127.0.0.1:10086/command";
const SESSION = "padayon-screenshots";
const OUT_DIR = path.join(__dirname, "../public/screenshots");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function send(action, args) {
  const res = await fetch(DAEMON, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args, session: SESSION }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(JSON.stringify(data));
  return data.data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(name) {
  const outPath = path.join(OUT_DIR, `${name}.png`);
  const result = await send("screenshot", { path: outPath });
  console.log("screenshot", name, result);
  return outPath;
}

async function main() {
  // Use localhost for interactive shots because Brave may block scripts on the tunnel URL.
  const base = process.argv[2] || "http://localhost:3000";
  const requestId = "demo-screenshot-2026-07-10";

  console.log("Navigating to landing...");
  await send("navigate", { url: base, newTab: true, group_title: "PADAYON screenshots" });
  await sleep(2000);
  await screenshot("01-landing");

  const prompt = "Explain photosynthesis like I'm 10";

  console.log("Navigating to demo page with chat + backend monitor (Gemma 4 autoSend)...");
  await send("navigate", {
    url: `${base}/demo?requestId=${requestId}&model=gemma-4&prompt=${encodeURIComponent(prompt)}&autoSend=1`,
    newTab: true,
  });
  await sleep(5000);

  console.log("Waiting for Gemma 4 reply (up to 90s)...");
  await sleep(90000);
  await screenshot("02-demo-with-events");

  console.log("Navigating to clean chat view for cover image...");
  await send("navigate", {
    url: `${base}/chat?userId=demo-user-id&requestId=${requestId}&model=gemma-4`,
    newTab: true,
  });
  await sleep(2000);
  await screenshot("03-chat-reply");

  console.log("Navigating to deck...");
  await send("navigate", { url: `${base}/deck`, newTab: true });
  await sleep(2000);
  await screenshot("04-deck");

  console.log("Done. Screenshots saved to", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
