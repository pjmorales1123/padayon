# PADAYON Demo Script

**Goal:** Show judges that PADAYON is not another chatbot — it is an agentic, curriculum-aligned, multilingual learning operating system for Filipino students.

**Setup before recording:**
1. Start the dev server: `npm run dev`
2. Scale up Gemma 4: `node scripts/gemma4-scale.js up`
3. Wait for `READY` (~2–4 minutes): `node scripts/gemma4-scale.js status`
4. Open `http://localhost:3000/demo`
5. Select **Gemma 4** in the chat header and confirm the purple badge appears.

---

## Opening (30 seconds)

> "Most education chatbots give you an answer and forget you. PADAYON turns messy student input into a complete, organized study pack — aligned to the Philippine curriculum, adapted to the student's language, and remembered for next time."

Navigate to `/` landing page, then click **See the live demo**.

---

## Beat 1 — Agent transparency (45 seconds)

> "First, we don't hide the AI. Every message triggers a pipeline of specialized agents. You can watch them work in real time."

In the `/demo` chat, type:
```
Explain photosynthesis like I'm 10
```

Point to the right panel:
- **Classifier Agent** detects subject, topic, intent, and language.
- **Curriculum Agent** aligns it to Grade 9 Science.
- **Teaching Agent** crafts the reply.
- **Memory Agent** updates the learner profile.

> "This observability is what makes PADAYON trustworthy for students and teachers."

---

## Beat 2 — Gemma 4 in action (30 seconds)

> "For this hackathon we are using Gemma 4 31B Instruct, deployed on-demand through Fireworks. If Gemma is ever unavailable, PADAYON automatically falls back to serverless models so the student is never stuck."

Click the model dropdown in the chat header and show **Gemma 4** selected with the purple active badge.

Type:
```
Make flashcards for photosynthesis
```

Show the flashcard widget appearing inline and the backend monitor finishing all steps.

---

## Beat 3 — Multilingual, adaptive teaching (45 seconds)

> "In the Philippines, many students think in Cebuano or Filipino first. PADAYON meets them in their strongest language, then bridges to the academic English term."

Type:
```
Unsa ang photosynthesis? Dili ko kasabot sa English.
```

Highlight:
- Reply starts in Cebuano.
- The English term **Photosynthesis** is explicitly introduced.
- A guiding question is asked.

> "Over time, the Memory Agent learns the student's confidence and adapts."

---

## Beat 4 — Photo notes to study pack (45 seconds)

> "Students often take handwritten notes. PADAYON can read them."

Use the 📷 button to upload a photo of handwritten notes (have a sample ready).

Show:
- OCR extraction.
- Automatic subject/topic creation.
- Flashcards and quiz generated from the photo.
- "View study pack" link.

Click the study pack link to show the Library/topic page.

---

## Beat 5 — Differentiation close (30 seconds)

Navigate to `/deck` and advance to the comparison slide.

> "Generic chatbots answer questions. PADAYON organizes, teaches, adapts, and remembers — in the language the student actually understands. That's why it wins."

---

## Closing (15 seconds)

> "PADAYON: keep learning going. Built for Filipino students, powered by Gemma 4 and AMD."

Show the final `/deck` thank-you slide.

---

## After recording

Scale Gemma 4 down to stop billing:

```bash
node scripts/gemma4-scale.js down
```
