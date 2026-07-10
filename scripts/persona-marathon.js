/* eslint-disable @typescript-eslint/no-require-imports */
// Persona marathon: run long conversations for 4 student types using fallback models,
// then compile a report of replies, profile changes, and generated materials.
const BASE = process.env.BASE_URL || "http://localhost:3000";

const personas = [
  {
    name: "Advanced Aiza",
    handle: "advanced",
    profile: {
      language_confidence: { English: "High", Cebuano: "Medium" },
      learning_style: { analogies: true, connections: true },
      strengths: ["reads ahead", "asks deep questions"],
      weaknesses: ["impatient with repetition"],
      study_habits: { pace: "fast", prefers: "concise" },
    },
    sequence: [
      "Explain photosynthesis like I'm 10",
      "How does cellular respiration connect to photosynthesis?",
      "Make flashcards for cellular respiration",
      "Quiz me on it",
      "Can you explain the role of ATP in simpler terms?",
    ],
  },
  {
    name: "Cebuano-only Carlo",
    handle: "cebuano",
    profile: {
      language_confidence: { Cebuano: "High", English: "Low" },
      learning_style: { stories: true, visuals: true },
      strengths: ["understands Bisaya examples"],
      weaknesses: ["academic English vocabulary"],
      study_habits: { pace: "slow", prefers: "stories" },
    },
    sequence: [
      "Unsa ang photosynthesis? Dili ko kasabot sa English.",
      "Ah okay. Unsa man ang chlorophyll?",
      "Himo og flashcard para nako.",
      "Pwede tagalog ang explanation?",
      "Salamat. Karon masabtan na nako.",
    ],
  },
  {
    name: "Struggling Sam",
    handle: "struggling",
    profile: {
      language_confidence: { English: "Medium" },
      learning_style: { short_steps: true, encouragement: true },
      strengths: ["tries again when encouraged"],
      weaknesses: ["low motivation", "gives up easily"],
      study_habits: { pace: "very slow", prefers: "tiny steps" },
    },
    sequence: [
      "I don't understand photosynthesis. It's too hard.",
      "I still don't get it. Can you make it super simple?",
      "Maybe I'm just dumb.",
      "Okay I'll try. What do plants need again?",
      "So plants make food and oxygen? That's cool actually.",
    ],
  },
  {
    name: "Wrong-answer Wendy",
    handle: "wrong",
    profile: {
      language_confidence: { English: "Medium" },
      learning_style: { quizzes: true, examples: true },
      strengths: ["willing to guess"],
      weaknesses: ["common misconceptions"],
      study_habits: { pace: "normal", prefers: "practice" },
    },
    sequence: [
      "Explain photosynthesis",
      { message: "I think plants breathe in oxygen for photosynthesis.", quizResult: { correct: false, topic: "Photosynthesis", question: "What gas do plants take in?" } },
      { message: "Wait, is it carbon dioxide?", quizResult: { correct: true, topic: "Photosynthesis", question: "What gas do plants take in?" } },
      "Make a quiz for me",
      { message: "I guess glucose is a type of gas?", quizResult: { correct: false, topic: "Photosynthesis", question: "What is glucose?" } },
    ],
  },
];

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text, status: res.status };
  }
}

async function createUser(name) {
  return fetchJson("/api/users", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

async function setProfile(userId, attrs) {
  return fetchJson("/api/profile", {
    method: "PUT",
    body: JSON.stringify({ userId, ...attrs }),
  });
}

async function getProfile(userId) {
  return fetchJson(`/api/profile?userId=${encodeURIComponent(userId)}`);
}

async function send(userId, item) {
  const body = typeof item === "string" ? { userId, message: item } : { userId, ...item };
  return fetchJson("/api/agent", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function getLibrary(userId) {
  return fetchJson(`/api/library?userId=${encodeURIComponent(userId)}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runPersona(persona) {
  console.log(`\n=== ${persona.name} ===`);
  const user = await createUser(persona.name);
  if (!user.userId) throw new Error(`Failed to create user: ${JSON.stringify(user)}`);
  const userId = user.userId;
  console.log(`Created user ${userId}`);

  await setProfile(userId, persona.profile);

  const startProfile = await getProfile(userId);
  const turns = [];

  for (let i = 0; i < persona.sequence.length; i++) {
    const item = persona.sequence[i];
    const label = typeof item === "string" ? item : JSON.stringify(item.message);
    console.log(`  Turn ${i + 1}: ${label.slice(0, 60)}`);
    const res = await send(userId, item);
    turns.push({
      turn: i + 1,
      input: item,
      reply: res.reply,
      classification: res.classification,
      curriculum: res.curriculum,
      materials_created: res.materials_created,
      topic: res.topic,
      error: res.error,
    });
    await sleep(1000); // gentle pacing
  }

  await sleep(3000); // let async memory update finish
  const endProfile = await getProfile(userId);
  const library = await getLibrary(userId);

  return {
    handle: persona.handle,
    name: persona.name,
    userId,
    startProfile,
    endProfile,
    turns,
    library,
  };
}

(async () => {
  const results = [];
  for (const p of personas) {
    try {
      results.push(await runPersona(p));
    } catch (err) {
      console.error(`Persona ${p.name} failed:`, err.message);
      results.push({ handle: p.handle, name: p.name, error: err.message });
    }
  }

  // Compile markdown report
  const lines = [
    "# PADAYON Persona Marathon Report",
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${BASE}`,
    "",
    "## Summary",
    "",
    "| Persona | User ID | Turns | Topics | Library Items |",
    "|---|---|---|---|---|",
  ];

  for (const r of results) {
    const topics = r.turns ? [...new Set(r.turns.map((t) => t.topic?.title).filter(Boolean))] : [];
    const libCount = r.library?.subjects?.reduce((acc, s) => acc + (s.topics?.length || 0), 0) || 0;
    lines.push(`| ${r.name} | \`${r.userId}\` | ${r.turns?.length || 0} | ${topics.join(", ")} | ${libCount} |`);
  }

  lines.push("", "## Demo Links", "");
  for (const r of results) {
    if (r.userId) {
      lines.push(`- **${r.name}**: [Chat](${BASE}/chat?userId=${r.userId}) · [Library](${BASE}/library?userId=${r.userId})`);
    }
  }

  for (const r of results) {
    lines.push("", `## ${r.name} (\`${r.handle}\`)`, "");
    if (r.error) {
      lines.push(`Error: ${r.error}`);
      continue;
    }
    lines.push(`**User ID:** \`${r.userId}\``);
    lines.push("");
    lines.push("**Profile change:**");
    lines.push("```json");
    lines.push(JSON.stringify({ before: r.startProfile?.profile, after: r.endProfile?.profile }, null, 2));
    lines.push("```");
    lines.push("");
    lines.push("**Conversation:**");
    for (const t of r.turns) {
      const inputLabel = typeof t.input === "string" ? t.input : t.input.message;
      lines.push(`### Student: ${inputLabel}`);
      lines.push(`_Intent:_ ${t.classification?.intent} · _Subject:_ ${t.classification?.subject} · _Topic:_ ${t.classification?.topic}`);
      lines.push("");
      lines.push(t.reply || "(no reply)");
      lines.push("");
      if (t.materials_created?.length) {
        lines.push(`_Created:_ ${t.materials_created.join(", ")}`);
        lines.push("");
      }
    }
    lines.push("**Library snapshot:**");
    lines.push("```json");
    lines.push(JSON.stringify(r.library, null, 2).slice(0, 2000));
    lines.push("```");
  }

  const report = lines.join("\n");
  require("fs").writeFileSync("PERSONA_MARATHON_REPORT.md", report);
  console.log("\nReport saved to PERSONA_MARATHON_REPORT.md");
})();
