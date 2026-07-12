import { callFireworks, ModelPreference, type ModelRuntimeReporter } from "./fireworks";
import { supabaseAdmin } from "./supabase";
import { isVisualLearningRequest } from "./visual-request";
import {
  Classification,
  CurriculumMatch,
  StudyPack,
  MemoryUpdate,
  ChatMessage,
  InteractivePayload,
} from "./types";

function extractJson<T>(content: string): T | null {
  if (!content) return null;
  const trimmed = content.trim();
  // Direct JSON
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Try extracting from markdown code fence
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]) as T;
      } catch {
        // fall through
      }
    }
    // Try extracting first {...} or [...]
    const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as T;
      } catch {
        // fall through
      }
    }
  }
  return null;
}

function cleanTeachingOutput(content: string): string {
  if (!content) return content;
  let cleaned = content;

  // Drop the entire leaked "The user wants me to act as..." reasoning block.
  cleaned = cleaned.replace(/The user wants me to act as[\s\S]*?(?=\n[A-Z][a-z]+,?\s*(?:[^:]|$))/im, "");

  // Strip common meta-commentary / planning prefixes that some reasoning models emit.
  const metaPatterns = [
    /^[\s\S]*?(?:Plan:|Draft:|Cebuano draft:|English draft:|Final output:|Now, output the final|Let me refine|This looks good|Wait,)[\r\n]+/im,
    /\n\s*(?:Plan:|Draft:|Cebuano draft:|English draft:|Final output:|Let me refine|This looks good|Wait,)[\s\S]*$/im,
    /\*\*(?:Plan|Draft|Final output)\*\*:?[\s\S]*$/im,
  ];
  for (const pattern of metaPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Collapse excessive blank lines.
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

function validateStudyPack(pack: Partial<StudyPack>): StudyPack {
  const clean_notes = (pack.clean_notes || "").trim();
  const reviewer = (pack.reviewer || "").trim();
  const summary = (pack.summary || "").trim();

  const flashcards = Array.isArray(pack.flashcards) ? pack.flashcards : [];
  const validFlashcards = flashcards
    .filter((c) => typeof c.front === "string" && typeof c.back === "string")
    .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
    .filter((c) => c.front.length > 0 && c.back.length > 0);

  const quiz = Array.isArray(pack.quiz) ? pack.quiz : [];
  const validQuiz = quiz
    .filter((q) => typeof q.question === "string" && Array.isArray(q.choices) && typeof q.answer === "string")
    .map((q) => ({
      question: q.question.trim(),
      choices: q.choices.map((c: string) => String(c).trim()).slice(0, 4),
      answer: q.answer.trim(),
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
    }))
    .filter((q) => q.question.length > 0 && q.choices.length === 4 && q.answer.length > 0 && q.choices.includes(q.answer));

  return {
    clean_notes: clean_notes.length > 20 ? clean_notes : `Clean notes about the topic.`,
    reviewer: reviewer.length > 20 ? reviewer : `Key points to remember.`,
    flashcards: validFlashcards.length >= 4 ? validFlashcards : [
      { front: `What is this topic about?`, back: `It is an important concept we are studying.` },
      { front: `Why does it matter?`, back: `It helps us understand how things work in class.` },
      { front: `Can you give an example?`, back: `Your teacher will give examples during the lesson.` },
      { front: `What should I review?`, back: `Focus on the main idea and key terms.` },
    ],
    quiz: validQuiz.length >= 3 ? validQuiz : [
      { question: `What is the topic we are studying?`, choices: ["A", "B", "C", "D"], answer: "A", explanation: "The topic is introduced in the lesson." },
      { question: `Why is this topic important?`, choices: ["A", "B", "C", "D"], answer: "A", explanation: "It connects to what you learn in school." },
      { question: `What should I ask my teacher if confused?`, choices: ["A", "B", "C", "D"], answer: "A", explanation: "Ask for examples from class." },
    ],
    summary: summary.length > 10 ? summary : `This topic is part of your class lesson.`,
    story: pack.story && pack.story.trim().length >= 20 ? pack.story.trim() : undefined,
    lesson_scope: pack.lesson_scope && Array.isArray(pack.lesson_scope.core_concepts) ? pack.lesson_scope : undefined,
    outside_scope: pack.outside_scope && Array.isArray(pack.outside_scope.advanced_concepts) ? pack.outside_scope : undefined,
  };
}

function formatHistory(history: ChatMessage[]): string {
  if (!history || history.length === 0) return "No previous messages.";
  return history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Student" : "PADAYON"}: ${m.content}`)
    .join("\n");
}

function keywordClassification(message: string): Classification {
  const lower = message.toLowerCase();
  const hasCebuano = /\b(unsa|ang|sa|ug|ako|ikaw|kini|siya|niini|sugilanon|istorya)\b/.test(lower);
  const hasFilipino = /\b(ano|ang|sa|at|ng|mga|ako|ikaw|ito|siya|kwento|kuwento)\b/.test(lower);
  const language = hasCebuano ? "Cebuano-English mix" : hasFilipino ? "Filipino-English mix" : "English";

  const retrieval = lower.includes("flashcard") || lower.includes("quiz") || lower.includes("reviewer") || lower.includes("review") || lower.includes("show my") || lower.includes("my flashcards") || lower.includes("my quiz") || lower.includes("my notes") || lower.includes("summary");
  const explicitCreation = lower.includes("create") || lower.includes("make") || lower.includes("build") || lower.includes("organize") || lower.includes("study pack") || lower.includes("notes");
  const visual = isVisualLearningRequest(message);
  const research = /didn't listen|missed the lesson|wala ko nakadungog|wala ko namatikdan|related topics|what did we talk about|what did you discuss|what topics|unsa among gisaysay|unsa among gipasabot/i.test(lower);
  let intent: Classification["intent"] = "teach_topic";
  if (research) intent = "research_topics";
  else if (visual) intent = "make_visual";
  else if (retrieval) intent = "retrieve_material";
  else if (explicitCreation) intent = "create_study_pack";

  const scienceKeywords = ["photosynthesis", "chlorophyll", "cellular respiration", "ecosystem", "cell", "organism", "mitosis", "meiosis", "genetics", "atom", "molecule", "periodic"];
  const mathKeywords = ["quadratic", "factoring", "formula", "polynomial", "equation", "algebra", "geometry", "fraction", "percent", "ratio", "function"];
  const englishKeywords = ["irony", "characterization", "point of view", "figurative language", "metaphor", "simile", "theme", "plot", "setting"];
  const filipinoKeywords = ["tula", "sanaysay", "pandiwa", "pang-uri", "pang-abay", "panahon", "pilipinas", "katipunan", "rebolusyon"];
  const socialKeywords = ["history", "revolution", "government", "democracy", "philippines", "economy", "culture", "war", "colonial", "treaty"];
  const ictKeywords = ["computer", "programming", "code", "html", "css", "javascript", "python", "database", "network", "algorithm"];
  const mapehKeywords = ["music", "art", "dance", "physical education", "pe", "health", "rhythm", "exercise", "nutrition"];

  const contains = (list: string[]) => list.some((k) => lower.includes(k));

  if (contains(scienceKeywords)) {
    let topic = "Science topic";
    if (lower.includes("photosynthesis")) topic = "Photosynthesis";
    else if (lower.includes("cellular respiration")) topic = "Cellular Respiration";
    else if (lower.includes("ecosystem")) topic = "Ecosystem";
    else if (lower.includes("cell")) topic = "Cell";
    return { subject: "Science", subcategory: "Biology", topic, intent, language_detected: language, confidence: 0.9 };
  }
  if (contains(mathKeywords)) {
    let topic = "Math topic";
    if (lower.includes("factoring")) topic = "Factoring";
    else if (lower.includes("quadratic formula")) topic = "Quadratic Formula";
    else if (lower.includes("quadratic")) topic = "Quadratic Equations";
    else if (lower.includes("geometry")) topic = "Geometry";
    return { subject: "Math", subcategory: "Algebra", topic, intent, language_detected: language, confidence: 0.9 };
  }
  if (contains(englishKeywords)) {
    const topics: string[] = [];
    if (lower.includes("point of view")) topics.push("Point of View");
    if (lower.includes("irony")) topics.push("Irony");
    if (lower.includes("characterization")) topics.push("Characterization");
    if (lower.includes("metaphor") || lower.includes("simile") || lower.includes("personification") || lower.includes("hyperbole") || lower.includes("figurative")) topics.push("Figures of Speech");
    if (lower.includes("theme")) topics.push("Theme");
    if (lower.includes("plot")) topics.push("Plot");
    if (lower.includes("setting")) topics.push("Setting");
    const topic = topics.length > 1 ? topics.join(" and ") : (topics[0] || "English topic");
    return { subject: "English", subcategory: "Literature", topic, intent, language_detected: language, confidence: 0.88 };
  }
  if (contains(filipinoKeywords)) {
    return { subject: "Filipino", subcategory: "Language", topic: "Filipino topic", intent, language_detected: hasCebuano ? "Cebuano-English mix" : "Filipino-English mix", confidence: 0.85 };
  }
  if (contains(socialKeywords)) {
    return { subject: "Social Studies", subcategory: "History", topic: "Social Studies topic", intent, language_detected: language, confidence: 0.85 };
  }
  if (contains(ictKeywords)) {
    return { subject: "ICT", subcategory: "Computer Science", topic: "ICT topic", intent, language_detected: language, confidence: 0.85 };
  }
  if (contains(mapehKeywords)) {
    return { subject: "MAPEH", subcategory: "Arts", topic: "MAPEH topic", intent, language_detected: language, confidence: 0.8 };
  }

  return {
    subject: "Unknown",
    subcategory: "Unknown",
    topic: message.slice(0, 40) || "Unknown",
    intent: "unknown",
    language_detected: language,
    confidence: 0.5,
  };
}

export async function classifierAgent(
  message: string,
  history: ChatMessage[] = [],
  model: ModelPreference = "auto"
): Promise<Classification> {
  const prompt = `You are the Classifier Agent for PADAYON, an AI learning partner for Filipino students.

Analyze the student input and return ONLY valid JSON with exactly these fields:
- subject (Science, Math, English, Filipino, ICT, Social Studies, MAPEH, or Unknown)
- subcategory
- topic (a short, specific topic title; if the notes cover multiple distinct concepts like "point of view" AND "dramatic irony", combine them into one topic title such as "Point of View and Dramatic Irony")
- intent (create_study_pack, teach_topic, make_flashcards, make_reviewer, make_quiz, make_summary, make_story, make_visual, retrieve_material, continue_learning, research_topics, unknown)
- language_detected (English, Filipino, Cebuano, Cebuano-English mix, Filipino-English mix, Other)
- confidence (number 0.0-1.0)

Intent rules:
- Use "teach_topic" when the student is asking a question, wants an explanation, or is just chatting about a topic (e.g., "What is meter?", "explain ezra pound", "let's play a game").
- Use "create_study_pack" when the student provides messy notes, a list of keywords, or study material to organize (e.g., "photosynthesis chlorophyll sunlight CO2", "irony sarcasm dramatic irony", or a pasted list of terms). Treat keyword dumps and pasted notes as material to organize, not as a question.
- Use "make_visual" when the student explicitly asks for a visual, diagram, infographic, chart, picture, or illustration of a topic (e.g., "show me a visual for photosynthesis", "diagram of cellular respiration", "infographic for quadratic equations").
- Use "make_summary" when the student asks for a summary, recap, or overview of the lesson (e.g., "give me a summary", "recap photosynthesis", "lesson summary").
- Use "retrieve_material" ONLY when the student explicitly asks to see existing saved materials (e.g., "show my flashcards", "where is my quiz", "my summary"). Do NOT use it for general questions like "look at" or "tell me about".
- Use "continue_learning" when the student clearly returns to a previous topic (e.g., "continue", "go back to").
- If the student refers to "these notes", "the notes I sent", "this", or "it" and a recent message contains uploaded notes, keep the same topic as the notes and use intent "teach_topic" or "create_study_pack" depending on whether they are asking a question or adding more notes.
- Use "research_topics" when the student missed a lesson, is unsure what topic to study, or asks what was discussed (e.g., "I didn't listen earlier, what did we talk about?", "wala ko nakadungog sa lesson ganina", "show me related topics", "what topics are in this subject?").
- Use "unknown" only if you cannot determine the subject or topic at all.

language_detected must be one of: English, Filipino, Cebuano, Cebuano-English mix, Filipino-English mix, Other.

Recent conversation:
${formatHistory(history)}

Current student input: "${message}"

Do not explain. Return JSON only.`;

  const content = await callFireworks(
    [
      { role: "system", content: "Return only valid JSON. No explanations, no markdown code fences, no text outside the JSON object." },
      { role: "user", content: prompt },
    ],
    true,
    1500,
    model
  );
  const parsed = extractJson<Classification>(content);
  if (parsed) return parsed;
  return keywordClassification(message);
}

export async function curriculumAgent(
  classification: Classification,
  model: ModelPreference = "auto"
): Promise<CurriculumMatch> {
  // Fast DB lookup first; fall back to LLM only if no seeded curriculum item matches.
  try {
    const { data: rows } = await supabaseAdmin!
      .from("curriculum_items")
      .select("*")
      .ilike("topic", classification.topic)
      .limit(1);

    if (rows && rows.length > 0) {
      const row = rows[0];
      return {
        grade_level: row.grade_level || "Grade 9",
        subject: row.subject || classification.subject,
        subcategory: row.subcategory || classification.subcategory,
        topic: row.topic || classification.topic,
        competency: row.competency || `Learn about ${classification.topic}`,
        previous_topic: row.previous_topic || null,
        next_topic: row.next_topic || null,
      };
    }
  } catch (err) {
    console.error("Curriculum DB lookup error:", err);
  }

  const prompt = `You are the Curriculum Alignment Agent for PADAYON.

Match the detected topic to a Grade 9 curriculum item. Return ONLY valid JSON with:
- grade_level
- subject
- subcategory
- topic
- competency
- previous_topic
- next_topic

If no exact match, return closest match and mark confidence.

Detected: ${JSON.stringify(classification)}`;

  const content = await callFireworks(
    [
      { role: "system", content: "Return only valid JSON. No explanations, no markdown code fences, no text outside the JSON object." },
      { role: "user", content: prompt },
    ],
    true,
    1500,
    model
  );
  const parsed = extractJson<CurriculumMatch>(content);
  if (parsed) return parsed;

  return {
    grade_level: "Grade 9",
    subject: classification.subject,
    subcategory: classification.subcategory,
    topic: classification.topic,
    competency: `Learn about ${classification.topic}`,
    previous_topic: null,
    next_topic: null,
  };
}

export async function researchAgent(
  message: string,
  classification: Classification,
  curriculumItems: Array<{ subject: string; topic: string; competency: string }>,
  profile: Record<string, unknown>,
  model: ModelPreference = "auto"
): Promise<string> {
  const prompt = `You are the Research Agent for PADAYON, an AI learning partner for Filipino students.

The student missed a lesson or is unsure what to study. Your job is to show them the most relevant topics and let them pick one to start with.

Student message: "${message}"
Detected subject: ${classification.subject}
Detected language: ${classification.language_detected}

${curriculumItems.length > 0
      ? `Here are curriculum topics that may be related:\n${curriculumItems
          .slice(0, 12)
          .map((c, i) => `${i + 1}. ${c.topic} (${c.subject}) — ${c.competency}`)
          .join("\n")}`
      : "No specific curriculum items were found."}

Learner profile: ${JSON.stringify(profile)}

Instructions:
- Use the student's strongest language(s) based on their profile. If the profile shows high confidence in both English and Cebuano/Filipino, give the response in both languages side by side.
- Pick the 3–5 most relevant topics from the list and present them as a numbered list.
- Add a one-sentence reason for each topic.
- Ask the student to type the number or name of the topic they want to start with.
- If there are no curriculum items, ask the student what subject or lesson title they discussed, and suggest a few general study areas.
- Keep it short, friendly, and focused on learning.
- Do not create materials yet. Just help the student choose a topic.`;

  const content = await callFireworks([{ role: "user", content: prompt }], false, 2000, model);
  if (content && content.trim().length > 10) return content;

  return `It looks like you missed a lesson. Can you tell me the subject or any word you remember from class? Then I can show you the topics we can study.`;
}

export async function materialCreatorAgent(
  notes: string,
  topic: string,
  curriculum: CurriculumMatch,
  profile: Record<string, unknown>,
  model: ModelPreference = "auto"
): Promise<StudyPack> {
  const prompt = `You are the Material Creator Agent for PADAYON, an AI learning partner for Grade 9 Filipino students.

Create a complete study pack based on the student notes, topic, curriculum match, and learner profile.

Return ONLY valid JSON with exactly these fields:
- clean_notes (string, 2-3 short paragraphs, clear and student-friendly)
- reviewer (string, bullet-point study guide)
- flashcards (array of 4-6 {front, back})
- quiz (array of 3-5 {question, choices: 4 options, answer, explanation})
- summary (string, 1-2 sentences)
- story (string, 1 short paragraph that explains the concept through a memorable character or real-life scenario)
- lesson_scope (object: { confirmed_by_student: false, core_concepts: array of 4-6 short concept names covered by this class lesson })
- outside_scope (object: { advanced_concepts: array of related concepts that are NOT part of this class lesson })

Use simple English or include Filipino/Cebuano terms only when the learner profile shows high confidence in that language.
Always include the English academic term (e.g., **photosynthesis**) at least once so the student learns the correct vocabulary.
Make the story relatable to a Filipino teenager.

Student notes: "${notes}"
Topic: ${topic}
Curriculum: ${JSON.stringify(curriculum)}
Learner profile: ${JSON.stringify(profile)}`;

  const content = await callFireworks(
    [
      { role: "system", content: "Return only valid JSON. No explanations, no markdown code fences, no text outside the JSON object." },
      { role: "user", content: prompt },
    ],
    true,
    2500,
    model
  );
  const parsed = extractJson<StudyPack>(content);
  if (parsed) {
    return validateStudyPack(parsed);
  }
  // Fallback seeded materials for Photosynthesis demo
  if (topic === "Photosynthesis") {
    return {
      clean_notes: "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to make glucose (food) and release oxygen. Chlorophyll in the leaves captures sunlight energy.",
      reviewer: "1. Photosynthesis uses sunlight, CO2, and water.\n2. Chlorophyll captures light energy.\n3. Products are glucose and oxygen.\n4. It happens in the leaves.",
      flashcards: [
        { front: "What is photosynthesis?", back: "The process where plants make food using sunlight, water, and carbon dioxide." },
        { front: "What does chlorophyll do?", back: "It captures sunlight energy for the plant." },
        { front: "What gas do plants take in during photosynthesis?", back: "Carbon dioxide." },
        { front: "What are the products of photosynthesis?", back: "Glucose and oxygen." }
      ],
      quiz: [
        {
          question: "What gas do plants take in during photosynthesis?",
          choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
          answer: "Carbon dioxide",
          explanation: "Plants use carbon dioxide, water, and sunlight to make glucose."
        },
        {
          question: "What does chlorophyll capture?",
          choices: ["Water", "Soil", "Sunlight energy", "Oxygen"],
          answer: "Sunlight energy",
          explanation: "Chlorophyll is the green pigment that captures sunlight for photosynthesis."
        }
      ],
      summary: "Photosynthesis is how plants make food using sunlight, water, and CO2, producing glucose and oxygen.",
      story: "Mang Tomas has a sari-sari store beside a big acacia tree. Every afternoon, the tree's wide leaves drink in sunlight and breathe in carbon dioxide from the air. Using water from the soil, the leaves cook up sugar to help the tree grow and release fresh oxygen for Mang Tomas and his customers. That invisible kitchen inside the leaf is photosynthesis."
    };
  }
  return {
    clean_notes: `Clean notes about ${topic}.`,
    reviewer: `Reviewer for ${topic}.`,
    flashcards: [{ front: `What is ${topic}?`, back: `${topic} is an important concept.` }],
    quiz: [{ question: `What is ${topic}?`, choices: ["A", "B", "C", "D"], answer: "A", explanation: "Because it is correct." }],
    summary: `Summary of ${topic}.`,
    story: `Imagine a student in the Philippines trying to understand ${topic}. With curiosity and practice, the idea becomes clear and useful.`
  };
}
export async function teachingAgent(
  message: string,
  topic: string,
  curriculum: CurriculumMatch,
  profile: Record<string, unknown>,
  history: ChatMessage[] = [],
  studyPack?: StudyPack,
  quizResult?: { correct: boolean; topic: string; question?: string } | null,
  classification?: Classification,
  model: ModelPreference = "auto",
  reportRuntime?: ModelRuntimeReporter,
  imageUrl?: string
): Promise<string> {
  const materialHint = studyPack
    ? imageUrl
      ? `\n\nStudy materials were organized from the uploaded picture. Briefly confirm the notes were saved, but do not summarize them, infer what the student wants to study, or automatically propose study materials. Ask what they would like to do with these notes.`
      : `\n\nStudy materials were organized for this topic. Only mention them if the student asked for them. Do not say "your flashcards are ready" or push the quiz unless the student explicitly asked for flashcards or a quiz. You may briefly say the topic is saved in their study pack if relevant.`
    : "";

  const quizHint = quizResult
    ? `\n\nThe student just answered a quiz question ${quizResult.correct ? "correctly" : "incorrectly"}. If incorrect, do not give the answer directly. Give a hint, address the misconception, and ask a guiding question.`
    : "";

  const imageHint = imageUrl
    ? `

The student uploaded a picture of their notes. Extracted text: "${message.replace(/"/g, '\"')}". In your reply, acknowledge receipt and confirm the notes were saved. Do not summarize the notes or infer why they uploaded them. Ask one short question about what they want to do with the notes. Do not say you cannot see images.`
    : "";

  const prompt = `You are the Teaching Agent for PADAYON, an AI learning partner for Grade 9 students in the Philippines.

Your goal is to help the student understand, not just give answers. Adapt your response to the learner profile below — it works for any student.

CRITICAL RULES:
- Reply directly to the student.
- NEVER show your planning, drafts, reasoning, self-corrections, or internal notes.
- NEVER use labels like "Plan:", "Draft:", "Cebuano draft:", "English:", "Final output:", "Wait," or "Let me".
- Start your response immediately with the friendly explanation. Output only the final student-facing answer.

How to adapt:
- Language: First, look at the actual student message. Then check learner profile language_confidence.
  • If the student's message is clearly in Filipino or Cebuano, reply mainly in that language.
  • If the student wrote in English but their profile shows Cebuano or Filipino as "High", give a bilingual reply: explain in the stronger local language first, then give the English version. Always include the English academic term **${topic}**.
  • If the profile shows only English as "High" (no local language High) or the student explicitly asked for English, reply in English.
  • Do not switch to Cebuano/Filipino just because the app is for Filipino students — only use it when the student's message or profile justifies it.
  • If there is no profile yet, reply in the language the student actually used.
- Learning style: Check learning_style. Use the preferred methods (e.g., analogies, visuals, stories, short steps, real-life examples). If learning_style includes "visuals" or "visual examples", proactively offer to create a visual, diagram, or infographic for the topic and end with a question like "Would you like me to make a visual for this?"
- Strengths: Build on the student's strengths.
- Weaknesses: Be gentle and scaffold. If a weakness is mentioned, give extra support in that area.
- Motivation: If the student sounds frustrated, unmotivated, or discouraged, be warm and encouraging. Break the idea into tiny, doable steps and celebrate effort.
- Challenge: If the student seems advanced or confident, go a little deeper, make connections, and ask a harder guiding question.
- Wrong answers: If a quiz result shows the answer was wrong, do NOT state the correct answer and do NOT give a mnemonic or trick that reveals it. Give only a hint, ask the student to rethink, and target the misconception with a guiding question.
- Keep it short and student-friendly. Use examples familiar to Filipino students when possible.
- Academic term: If you respond partly in Filipino or Cebuano, you MUST include the English academic term **${topic}** at least once so the student learns the correct vocabulary.
- Ask one guiding question at the end.
- Treat the current student message and current Topic as the source of truth. Use recent conversation when the student refers to "these notes", "the notes", "this", "it", "them", or asks a clarification about something shared earlier. Otherwise, do not say "since you asked about..." or combine a previous topic with the current one unless the student explicitly makes that connection.

Learner profile: ${JSON.stringify(profile)}
Topic: ${topic}
Curriculum: ${JSON.stringify(curriculum)}${materialHint}${quizHint}${imageHint}

Recent conversation:
${formatHistory(history)}

Student message: "${message}"

Output ONLY a JSON object in this exact format, with no other text before or after:
{
  "reply": "the complete, friendly, student-facing explanation including the guiding question at the end",
  "question": "the one guiding question you ask at the end"
}`;

  const content = await callFireworks(
    [
      { role: "system", content: "You are a final-output teaching assistant. You never reveal planning, drafts, or reasoning. You only return valid JSON matching the requested schema." },
      { role: "user", content: prompt },
    ],
    true,
    2500,
    model,
    reportRuntime
  );

  // Try to parse the structured reply first.
  const parsed = extractJson<{ reply?: string; question?: string }>(content);
  if (parsed?.reply && parsed.reply.trim().length > 10) {
    return parsed.reply.trim();
  }

  // Fallback to text cleanup if the model returned free-form text.
  const cleaned = cleanTeachingOutput(content);
  if (cleaned && cleaned.trim().length > 10) return cleaned;

  // Fallback for demo
  const lower = message.toLowerCase();
  if (lower.includes("unsa") && lower.includes("photosynthesis")) {
    return `Atong sabton una sa simple nga paagi.

Ang photosynthesis mao ang proseso nga gigamit sa tanom aron makahimo og pagkaon gamit ang sunlight.

English term to remember:
Photosynthesis means the process where plants make food using sunlight.

Now try this:
What are two things plants need for photosynthesis?`;
  }

  return `Let's learn about ${topic} step by step.

${curriculum.competency}

Can you tell me what you already know about it?`;
}

export async function studentReplyReview(
  originalReply: string,
  message: string,
  topic: string,
  curriculum: CurriculumMatch,
  classification: Classification,
  profile: Record<string, unknown>,
  model: ModelPreference = "auto",
  reportRuntime?: ModelRuntimeReporter
): Promise<string> {
  if (!originalReply || originalReply.trim().length < 10) return originalReply;

  const prompt = `You are the "Student Helpfulness Reviewer" for PADAYON, an AI learning partner for Grade 9 students in the Philippines.

Your ONE job: read the AI's draft reply below and decide if it actually helps the student. If it does, return it mostly unchanged. If it doesn't, rewrite it to be more helpful.

Common problems to fix:
- Claims the student "already learned" something we don't know they learned.
- Asks a question that is irrelevant, too hard, or unrelated to what the student asked.
- Explanation is too complex, uses jargon, or skips the basics.
- Examples are confusing or not relatable to a Filipino Grade 9 student.
- Uses Bisaya/Cebuano words that are too deep or obscure; keep it simple and natural.
- Adds unverified facts or hallucinates details not in the curriculum.
- Sounds robotic, preachy, or discouraging.

Rules for the rewrite:
- Keep the same language mix the draft uses (English, Filipino, Cebuano) unless the draft got it wrong.
- Keep the English academic term **${topic}** at least once.
- Use simple, relatable examples (school, family, local context).
- Ask only ONE relevant guiding question at the end.
- Do NOT add headings like "Improved reply:". Return only the final text.

Curriculum: ${JSON.stringify(curriculum)}
Student message: "${message.replace(/"/g, '\\"')}"
Draft reply:
"""
${originalReply}
"""

Return ONLY a JSON object:
{"improved_reply": "the final reply, or the original if no changes needed"}`;

  try {
    const content = await callFireworks(
      [
        { role: "system", content: "You review student-facing replies and return only valid JSON with an improved_reply field." },
        { role: "user", content: prompt },
      ],
      true,
      2500,
      model,
      reportRuntime
    );

    const parsed = extractJson<{ improved_reply?: string }>(content);
    if (parsed?.improved_reply && parsed.improved_reply.trim().length > 10) {
      return parsed.improved_reply.trim();
    }
  } catch (err) {
    console.error("studentReplyReview failed", err);
  }

  return originalReply;
}

export async function memoryAgent(
  message: string,
  quizResult: { correct: boolean; topic: string; question?: string } | null,
  profile: Record<string, unknown>,
  model: ModelPreference = "auto"
): Promise<MemoryUpdate> {
  const prompt = `You are the Memory Agent for PADAYON.

Update the learner profile based on the latest interaction.

Rules:
- If the student explicitly says they are NOT good at a language (e.g. "I am not good at English", "hindi ako magaling sa English"), set language_confidence_update to "English: Low" or the relevant language to "Low". Do not contradict the student.
- If the student asks to switch languages (e.g. "explain in Filipino", "sa Cebuano ko sabta"), set language_confidence_update to reflect the requested language as the preferred one (e.g. "Filipino: High" or "Cebuano: High").
- Only infer learning style, strengths, and weaknesses from this single message or the provided quiz result. Do not hallucinate.
- If the student asks for a visual, diagram, picture, infographic, chart, or example they can see, set learning_style_update to include "visuals" or "visual examples".
- If the student corrects an existing profile entry, update it.
- student_note is only for a short fact, goal, feeling, score, or class event the student explicitly states (for example, "Got a low score in a Math quiz" or "Wants to learn Biology"). Otherwise return an empty string. Never infer it, never save sensitive details, and never save an upload's contents as a personal note.

Return ONLY valid JSON with these exact string fields:
- learning_style_update: string (one short phrase, e.g. "visuals, analogies")
- language_confidence_update: string (one short phrase, e.g. "Cebuano: High")
- weakness_update: string (specific, short)
- strength_update: string (specific, short)
- next_recommended_action: string (specific next step for the student)
- student_note: string (one explicit student-shared note, or an empty string)

All six values must be plain strings, not arrays or objects.

Student message: "${message}"
Quiz result: ${JSON.stringify(quizResult)}
Current profile: ${JSON.stringify(profile)}`;

  const content = await callFireworks(
    [
      { role: "system", content: "Return only valid JSON. No explanations, no markdown code fences, no text outside the JSON object." },
      { role: "user", content: prompt },
    ],
    true,
    1500,
    model
  );
  const parsed = extractJson<MemoryUpdate>(content);
  if (parsed) {
    // Guard against models returning arrays/objects despite instructions
    return {
      learning_style_update: Array.isArray(parsed.learning_style_update) ? parsed.learning_style_update.join(" ") : String(parsed.learning_style_update || ""),
      language_confidence_update: Array.isArray(parsed.language_confidence_update) ? parsed.language_confidence_update.join(" ") : String(parsed.language_confidence_update || ""),
      weakness_update: Array.isArray(parsed.weakness_update) ? parsed.weakness_update.join(" ") : String(parsed.weakness_update || ""),
      strength_update: Array.isArray(parsed.strength_update) ? parsed.strength_update.join(" ") : String(parsed.strength_update || ""),
      next_recommended_action: Array.isArray(parsed.next_recommended_action) ? parsed.next_recommended_action.join(" ") : String(parsed.next_recommended_action || ""),
      student_note: Array.isArray(parsed.student_note) ? parsed.student_note.join(" ") : String(parsed.student_note || ""),
    };
  }
  return {
    learning_style_update: "Learns well with analogies and short explanations",
    language_confidence_update: "Use Cebuano-first explanation for new Science topics",
    weakness_update: "Needs review on process order in Photosynthesis",
    strength_update: "Understands better with real-life examples",
    next_recommended_action: "Review flashcards for Photosynthesis",
    student_note: ""
  };
}

const VISUAL_LLM_TIMEOUT_MS = 20000;

const VISUAL_SYSTEM_PROMPT = `You are an expert visual designer and front-end developer. Your job is to turn a lesson topic into a single HTML visual that looks like a Canva Code infographic.

Rules:
- Return ONLY valid JSON with this shape: {"title": "...", "html": "..."}
- The html value must be a complete <!DOCTYPE html> document.
- Load Tailwind CSS with this exact tag in the <head>: <script src="https://cdn.tailwindcss.com"></script>.
- Load a clean font such as DM Sans or Inter from Google Fonts.
- Use emoji as large visual icons at the top of each concept card (e.g., 👤⚔️👤, 🧠💭, 👤🆚🌍).
- Lay out concepts as a responsive grid of rounded cards with soft shadows and pastel backgrounds.
- Use geometric shapes, connecting lines, or arrows between cards when showing relationships or flow.
- Keep text short and readable; put detailed explanations inside cards or below the icon.
- Do not use external images, <img>, or <canvas>.
- Do not use JavaScript.
- Do not include markdown code fences or any text outside the JSON object.`;

function buildVisualUserPrompt(
  topic: string,
  studyPack: StudyPack,
  classification: Classification
): string {
  const lang = classification.language_detected || "English";
  const notes = studyPack.clean_notes || studyPack.summary || `Learn about ${topic}.`;
  const keyPoints = notes
    .split(/\.|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.length < 120)
    .slice(0, 5);
  const flashcards = (studyPack.flashcards || [])
    .slice(0, 3)
    .map((c, i) => `${i + 1}. ${c.front} → ${c.back}`)
    .join("\n") || "None";

  return `Create a Canva-style visual infographic for the topic "${topic}".
Language: ${lang}

Key points to visualize (use these as labeled nodes or steps):
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n") || "1. Explore the topic step by step."}

Flashcards to include as mini summary boxes:
${flashcards}

Design requirements (Canva Code style):
1. Use Tailwind CSS classes for layout, spacing, colors, rounded corners, and shadows. Load Tailwind with <script src="https://cdn.tailwindcss.com"></script>.
2. Display each main concept as a rounded card in a responsive grid (1 col on mobile, 2-3 cols on larger screens).
3. Place a large emoji icon (or emoji combo) at the top of every card to represent the concept visually.
4. Add a bold card title and a one-sentence description below the icon.
5. Include a central title/header for the topic using a gradient or colored background.
6. Use connecting lines, arrows, or a simple flow diagram between cards when the topic has steps or relationships.
7. Use a soft pastel color palette and plenty of white space.
8. Keep the page compact, mobile-friendly, and free of JavaScript.

Return JSON only.`;
}

function buildFastHtmlVisual(
  topic: string,
  studyPack: StudyPack,
  classification: Classification
): { title: string; html: string } {
  const lang = classification.language_detected || "English";
  const keyPoints = (studyPack.clean_notes || studyPack.summary || `Learn about ${topic}.`)
    .split(/\.|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.length < 140)
    .slice(0, 5);

  const flashcards = (studyPack.flashcards || []).slice(0, 3);
  const topicLower = topic.toLowerCase();

  const emojiFor = (text: string, index: number): string => {
    const lower = text.toLowerCase();
    if (topicLower.includes("conflict")) {
      if (lower.includes("person") || lower.includes("man") || lower.includes("character")) return "👤⚔️👤";
      if (lower.includes("self") || lower.includes("inner")) return "🧠💭";
      if (lower.includes("society") || lower.includes("community")) return "👤🆚🏛️";
      if (lower.includes("nature") || lower.includes("environment")) return "👤🆚🌍";
      if (lower.includes("technology") || lower.includes("machine")) return "👤🆚⚙️";
    }
    if (topicLower.includes("photosynthesis")) {
      if (lower.includes("sun") || lower.includes("light")) return "☀️";
      if (lower.includes("water")) return "💧";
      if (lower.includes("carbon") || lower.includes("co2")) return "🌬️";
      if (lower.includes("chloroplast") || lower.includes("leaf")) return "🌿";
      if (lower.includes("glucose") || lower.includes("food")) return "🍬";
    }
    const generic = ["💡", "🔵", "🟢", "🟡", "🔴", "🧩", "⭐", "📘", "🎯", "🌟"];
    return generic[index % generic.length];
  };

  const cardBg = [
    "bg-rose-50 border-rose-200",
    "bg-amber-50 border-amber-200",
    "bg-emerald-50 border-emerald-200",
    "bg-sky-50 border-sky-200",
    "bg-violet-50 border-violet-200",
  ];

  const conceptCards = keyPoints.map((p, i) => {
    const words = escapeHtml(p).split(" ");
    const title = words.slice(0, 4).join(" ") || `Point ${i + 1}`;
    const desc = words.slice(4).join(" ") || escapeHtml(p);
    return `
    <div class="${cardBg[i % cardBg.length]} border rounded-2xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
      <div class="text-5xl mb-3">${emojiFor(p, i)}</div>
      <h3 class="font-bold text-slate-800 mb-1">${title}</h3>
      <p class="text-sm text-slate-600 leading-snug">${desc}</p>
    </div>`;
  }).join("");

  const flashCards = flashcards.map((c, i) => `
    <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center shadow-sm">
      <div class="text-2xl mb-2">${emojiFor(c.front, i + keyPoints.length)}</div>
      <h4 class="font-semibold text-indigo-900 text-sm mb-1">${escapeHtml(c.front)}</h4>
      <p class="text-xs text-indigo-700">${escapeHtml(c.back)}</p>
    </div>`).join("");

  const html = `<!DOCTYPE html>\r\n<html lang="en">\r\n<head>\r\n<meta charset="UTF-8">\r\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\r\n<title>${escapeHtml(topic)} Visual</title>\r\n<script src="https://cdn.tailwindcss.com"></script>\r\n<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">\r\n<style>body{font-family:'DM Sans',sans-serif;}</style>\r\n</head>\r\n<body class="min-h-screen p-6 bg-gradient-to-br from-sky-50 to-indigo-50">\r\n<main class="max-w-3xl mx-auto">\r\n  <div class="bg-gradient-to-r from-sky-500 to-indigo-600 rounded-2xl p-6 mb-6 text-white shadow-lg text-center">\r\n    <h1 class="text-2xl font-bold mb-1">${escapeHtml(topic)}</h1>\r\n    <p class="text-sm opacity-90">Visual guide · ${escapeHtml(lang)}</p>\r\n  </div>\r\n  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">${conceptCards}</div>\r\n  ${flashCards ? `<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">${flashCards}</div>` : ""}\r\n  <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">\r\n    <strong>Study tip:</strong> Say each concept out loud, then cover the description and try to explain it in your own words.\r\n  </div>\r\n</main>\r\n</body>\r\n</html>`;

  return { title: `${topic} Visual`, html };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeVisualHtml(html: string): string {
  // Models sometimes load Tailwind as a stylesheet link instead of a script.
  return html.replace(
    /<link[^>]+href=["']https:\/\/cdn\.tailwindcss\.com["'][^>]*>/gi,
    '<script src="https://cdn.tailwindcss.com"></script>'
  );
}

export async function htmlVisualAgent(
  topic: string,
  studyPack: StudyPack,
  classification: Classification,
  model: ModelPreference = "auto"
): Promise<{ title: string; html: string } | null> {
  const userPrompt = buildVisualUserPrompt(topic, studyPack, classification);

  try {
    const llmPromise = callFireworks(
      [
        { role: "system", content: VISUAL_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      true,
      2500,
      model
    );

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("Visual generation timed out")), VISUAL_LLM_TIMEOUT_MS)
    );

    const content = await Promise.race([llmPromise, timeoutPromise]);
    const parsed = extractJson<{ title: string; html: string }>(content);

    if (parsed?.html && parsed.html.trim().length > 200) {
      let html = normalizeVisualHtml(parsed.html.trim());
      if (!html.toLowerCase().startsWith("<!doctype")) {
        html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${escapeHtml(parsed.title || topic)}</title>\n<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,\\"Segoe UI\\",Roboto,sans-serif;margin:0;padding:16px;background:#f8fafc;}</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
      }
      return { title: parsed.title || `${topic} Visual`, html };
    }
  } catch (err) {
    console.warn("AI visual generation failed or timed out, falling back to template", err);
  }

  // Fast fallback: reliable, instant visual with icons, lines, and shapes.
  return buildFastHtmlVisual(topic, studyPack, classification);
}

export async function visualDesignerAgent(
  message: string,
  topicId: string,
  topicTitle: string,
  studyPack: StudyPack | null | undefined,
  classification: Classification,
  model: ModelPreference = "auto"
): Promise<InteractivePayload | null> {
  if (!studyPack) return null;

  const lower = message.toLowerCase();
  const wantsFlashcards = classification.intent === "make_flashcards" || /flashcard|flash card|card/i.test(lower);
  const wantsQuiz = classification.intent === "make_quiz" || /quiz|test|question/i.test(lower);
  const wantsTable = /table|compare|comparison|difference|versus|vs\.?/i.test(lower);
  const wantsVisual = classification.intent === "make_visual" || isVisualLearningRequest(message);

  if (wantsFlashcards && studyPack.flashcards && studyPack.flashcards.length > 0) {
    return {
      type: "flashcards",
      topic: topicTitle,
      topicId,
      cards: studyPack.flashcards,
    };
  }

  if (wantsQuiz && studyPack.quiz && studyPack.quiz.length > 0) {
    return {
      type: "quiz",
      topic: topicTitle,
      topicId,
      questions: studyPack.quiz,
    };
  }

  if (wantsTable) {
    // Try to derive a comparison table from clean notes or quiz
    const headers = ["Feature", "Details"];
    const rows: string[][] = [];
    const sentences = (studyPack.clean_notes || studyPack.summary || "")
      .split(/\.|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
    sentences.slice(0, 6).forEach((s) => {
      const parts = s.split(/:\s*/);
      if (parts.length >= 2) {
        rows.push([parts[0].trim(), parts.slice(1).join(": ").trim()]);
      } else if (s.toLowerCase().includes(" ")) {
        const words = s.split(" ");
        const mid = Math.ceil(words.length / 2);
        rows.push([words.slice(0, mid).join(" "), words.slice(mid).join(" ")]);
      }
    });
    if (rows.length > 0) {
      return {
        type: "comparison_table",
        topic: topicTitle,
        topicId,
        headers,
        rows,
      };
    }
  }

  if (wantsVisual) {
    const htmlResult = await htmlVisualAgent(topicTitle, studyPack, classification, model);
    if (htmlResult) {
      return {
        type: "html_visual",
        topic: topicTitle,
        topicId,
        title: htmlResult.title,
        html: htmlResult.html,
      };
    }
  }

  // Do not show widgets by default for create_study_pack unless the student explicitly asked for one.
  return null;
}
