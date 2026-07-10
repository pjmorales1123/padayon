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
const USER_ID = "demo-user-id";
const TIMEOUT_MS = 90000;

let passed = 0;
let failed = 0;
const failures = [];

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

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push(`${name}: ${err.message}`);
    console.error(`❌ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

async function main() {
  console.log(`Running PADAYON smoke tests against ${BASE_URL}\n`);

  await test("Health check returns ready", async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/health`);
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert(data.ready === true, JSON.stringify(data));
  });

  await test("Seed demo user and curriculum", async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID }),
    });
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert(data.success, JSON.stringify(data));
  });

  await test("GET profile returns user", async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/profile?userId=${USER_ID}`);
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert(data.user && data.user.id === USER_ID, JSON.stringify(data));
    assert(data.profile, "missing profile");
  });

  let topicId = null;

  await test("Agent returns useful response for photosynthesis", async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: USER_ID,
        message: "photosynthesis chlorophyll sunlight CO2 oxygen glucose food important",
      }),
    });
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert(data.reply, "missing reply");
    assert(data.classification, "missing classification");
    assert(data.classification.subject === "Science", `subject: ${data.classification.subject}`);
    assert(data.topic && data.topic.id, "missing topic");
    if (data.materials_created && data.materials_created.length > 0) {
      assert(data.materials_created.includes("flashcards"), "flashcards not created");
      assert(data.materials_created.includes("quiz"), "quiz not created");
    }
    topicId = data.topic.id;
  });

  await test("Library returns organized folders", async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/library?userId=${USER_ID}`);
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.subjects) && data.subjects.length > 0, "no subjects");
    const subject = data.subjects.find((s) => s.name === "Science");
    assert(subject, "Science subject missing");
    assert(Array.isArray(subject.topics) && subject.topics.length > 0, "no topics");
    const topic = subject.topics.find((t) => t.title.toLowerCase().includes("photosynthesis"));
    assert(topic, "photosynthesis topic missing");
    assert(Array.isArray(topic.materials) && topic.materials.length >= 5, `materials: ${topic.materials?.length}`);
    topicId = topic.id;
  });

  await test("Agent retrieves flashcards", async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: USER_ID,
        message: "show my flashcards for photosynthesis",
      }),
    });
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert(data.reply, "missing reply");
    assert(data.reply.toLowerCase().includes("photosynthesis"), "reply missing topic");
    assert(/1\.|front|back|→/i.test(data.reply), "reply does not contain flashcards");
  });

  await test("Topic endpoint returns materials and story", async () => {
    assert(topicId, "topicId not set");
    const res = await fetchWithTimeout(`${BASE_URL}/api/topic/${topicId}`);
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert(data.topic, "missing topic");
    assert(Array.isArray(data.topic.materials), "missing materials");
    const types = data.topic.materials.map((m) => m.type);
    assert(types.includes("flashcards"), "flashcards material missing");
    assert(types.includes("quiz"), "quiz material missing");
    assert(types.includes("story"), "story material missing");
  });

  await test("Quiz submission updates progress", async () => {
    assert(topicId, "topicId not set");
    const topicRes = await fetchWithTimeout(`${BASE_URL}/api/topic/${topicId}`);
    const topicData = await topicRes.json();
    const quiz = topicData.topic.materials.find((m) => m.type === "quiz")?.content?.quiz || [];
    assert(quiz.length > 0, "no quiz questions");
    const score = quiz.length;
    const res = await fetchWithTimeout(`${BASE_URL}/api/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: USER_ID,
        topicId,
        score,
        total: quiz.length,
        answers: quiz.map((q, i) => ({ questionIndex: i, selected: q.answer, correct: true })),
      }),
    });
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert(data.success, JSON.stringify(data));
    assert(data.passed === true, "should pass");
    assert(data.percentage === 100, `percentage ${data.percentage}`);
  });

  await test("PUT profile updates language confidence", async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: USER_ID,
        name: "Prince",
        language_confidence: { English: "High", Cebuano: "High" },
      }),
    });
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert(data.success, JSON.stringify(data));
    assert(data.profile.language_confidence.English === "High", "English not updated");
  });

  await test("Folder CRUD endpoints work", async () => {
    const createRes = await fetchWithTimeout(`${BASE_URL}/api/library`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, name: "Smoke Test Folder" }),
    });
    assert(createRes.ok, `create status ${createRes.status}`);
    const createData = await createRes.json();
    assert(createData.success && createData.subject, JSON.stringify(createData));
    const subjectId = createData.subject.id;

    const renameRes = await fetchWithTimeout(`${BASE_URL}/api/library`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, name: "Renamed Smoke Folder" }),
    });
    assert(renameRes.ok, `rename status ${renameRes.status}`);

    const deleteRes = await fetchWithTimeout(`${BASE_URL}/api/library?subjectId=${subjectId}`, {
      method: "DELETE",
    });
    assert(deleteRes.ok, `delete status ${deleteRes.status}`);
  });

  console.log("\n------------------------------");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test runner error:", err);
  process.exit(1);
});
