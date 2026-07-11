/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

// Load .env.local
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

const BASE_URL = process.env.SMOKE_TEST_URL || "http://localhost:3000";
const TIMEOUT_MS = 120000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function seedUser(userId) {
  const res = await fetchWithTimeout(`${BASE_URL}/api/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`seed failed ${res.status}`);
  return res.json();
}

async function setProfile(userId, profile) {
  const res = await fetchWithTimeout(`${BASE_URL}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...profile }),
  });
  if (!res.ok) throw new Error(`profile failed ${res.status}`);
  return res.json();
}

async function chat(userId, message, quizResult) {
  const body = { userId, message, model: "auto" };
  if (quizResult) body.quizResult = quizResult;
  const res = await fetchWithTimeout(`${BASE_URL}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`agent failed ${res.status}`);
  return res.json();
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

const personas = [
  {
    id: "persona-advanced",
    name: "Alex",
    label: "Advanced student",
    profile: {
      name: "Alex",
      language_confidence: { English: "High", "Academic English": "High" },
      learning_style: { deep_explanations: true, connections: true, self_paced: true },
      strengths: ["analytical thinking", "self-directed learning", "making connections"],
      weaknesses: ["none"],
      study_habits: { preferred_time: "morning", review_frequency: "daily" },
    },
    message:
      "I already understand that plants make glucose during photosynthesis. Can you explain how photosynthesis and cellular respiration are connected at a deeper level?",
    check(reply) {
      const lower = reply.toLowerCase();
      assert(reply.length > 300, "reply too short for advanced student");
      assert(lower.includes("?"), "expected a guiding question");
      assert(
        /atp|energy|cycle|relationship|connected|mitochondria|chloroplast/i.test(reply),
        "expected deeper connection to energy/ATP/cell parts"
      );
    },
  },
  {
    id: "persona-cebuano",
    name: "Marie",
    label: "Non-English speaker (Cebuano-first)",
    profile: {
      name: "Marie",
      language_confidence: { Cebuano: "High", Filipino: "Medium", English: "Developing" },
      learning_style: { visuals: true, stories: true, short_explanations: true },
      strengths: ["listening", "learning through stories"],
      weaknesses: ["academic English vocabulary"],
      study_habits: { preferred_time: "afternoon" },
    },
    message: "Unsa ang photosynthesis? Dili ko kasabot sa English.",
    check(reply) {
      const cebuanoWords = ["ang", "sa", "ug", "kini", "siya", "ikaw", "ako", "nimo", "niini", "sabton"];
      const cebuanoCount = cebuanoWords.filter((w) => reply.toLowerCase().includes(w)).length;
      assert(cebuanoCount >= 2, `expected Cebuano words, found ${cebuanoCount}`);
      assert(
        /photosynthesis/i.test(reply),
        "expected the English academic term 'photosynthesis' to be introduced"
      );
    },
  },
  {
    id: "persona-motivation",
    name: "Juan",
    label: "Student struggling with motivation",
    profile: {
      name: "Juan",
      language_confidence: { English: "Medium", Filipino: "Medium" },
      learning_style: { short_explanations: true, encouragement: true, step_by_step: true },
      strengths: ["effort", "willingness to try"],
      weaknesses: ["low motivation", "easily discouraged", "long explanations"],
      study_habits: { preferred_time: "evening", review_frequency: "when forced" },
    },
    message: "Photosynthesis is too hard. I don't think I can learn this.",
    check(reply) {
      const lower = reply.toLowerCase();
      const encouraging =
        /you can|let's|small step|one step|try|don't give up|kaya|kayang|sige|subukan|maliit|hakbang|walang mali|ok lang|okay lang/i.test(lower);
      assert(encouraging, "expected encouraging tone for low-motivation student");
      assert(reply.length < 900, "reply should be short and not overwhelming");
    },
  },
  {
    id: "persona-wrong-answer",
    name: "Sam",
    label: "Student who got the wrong answer",
    profile: {
      name: "Sam",
      language_confidence: { English: "Medium" },
      learning_style: { practice_questions: true, examples: true },
      strengths: ["willing to try", "asking questions"],
      weaknesses: ["mixing up concepts", "rushing"],
      study_habits: { preferred_time: "afternoon" },
    },
    message: "I said plants release carbon dioxide during photosynthesis, but my teacher marked it wrong.",
    quizResult: {
      correct: false,
      topic: "Photosynthesis",
      question: "What gas do plants release during photosynthesis?",
    },
    check(reply) {
      const lower = reply.toLowerCase();
      assert(
        /hint|think|why|remember|look at| reconsider/i.test(lower),
        "expected a hint or guiding question, not a direct answer"
      );
      assert(!/the correct answer is oxygen/i.test(lower), "should not give the answer outright");
      assert(lower.includes("?"), "expected a guiding question");
    },
  },
];

async function main() {
  console.log(`Running PADAYON persona tests against ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  for (const p of personas) {
    console.log(`--- ${p.label}: ${p.name} ---`);
    try {
      await seedUser(p.id);
      await setProfile(p.id, p.profile);
      const data = await chat(p.id, p.message, p.quizResult);

      console.log("Profile:", JSON.stringify(p.profile, null, 2));
      console.log("Student:", p.message);
      console.log("PADAYON:\n", data.reply);
      p.check(data.reply);
      console.log("✅ Checks passed\n");
      passed++;
    } catch (err) {
      console.error(`❌ Failed: ${err.message}\n`);
      failed++;
    }
  }

  console.log("------------------------------");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Persona test runner error:", err);
  process.exit(1);
});
