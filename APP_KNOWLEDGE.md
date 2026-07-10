# PADAYON — App Knowledge Reference

This file is a living reference for the PADAYON AI learning partner app. It documents architecture, data flow, environment, agents, endpoints, and operational notes so the assistant can pick up work quickly even after context compaction.

---

## 1. Project Overview

- **Name:** PADAYON
- **Purpose:** AI learning partner for Filipino Grade 9 students.
- **Core promise:** Explain topics in English/Filipino/Cebuano, auto-build study materials (notes, reviewer, flashcards, quiz, summary, story), adapt to the learner, and organize everything in a personal library.
- **Current deployment:** Next.js 16 app running locally on `http://localhost:3000`, exposed via Cloudflare tunnel for mobile/demo access.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) |
| ORM/Client | `@supabase/supabase-js` (admin client in `src/lib/supabase.ts`) |
| LLM inference | Fireworks AI API (`/inference/v1/chat/completions`) |
| Default models | `accounts/fireworks/models/deepseek-v4-flash` (primary), `accounts/fireworks/models/kimi-k2p5` (fallback) |
| Vision model | `accounts/fireworks/models/kimi-k2p6` (for image OCR) |
| Gemma 4 demo | Fireworks on-demand deployment `accounts/princejirehmorales-2/deployments/ymlz8joa` (Gemma 4 31B) |
| Deployment | Currently local `npm start` + Cloudflare tunnel |

---

## 3. Environment Variables

Stored in `.env.local` (never commit):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Fireworks AI (serverless)
FIREWORKS_API_KEY=
FIREWORKS_MODEL=accounts/fireworks/models/deepseek-v4-flash
FIREWORKS_FALLBACK_MODEL=accounts/fireworks/models/kimi-k2p5
FIREWORKS_VISION_MODEL=accounts/fireworks/models/kimi-k2.6

# Gemma endpoints (optional, used for demo)
GEMMA_4_DEPLOYMENT=accounts/princejirehmorales-2/deployments/ymlz8joa
GEMMA_4_MODEL_NAME=accounts/fireworks/models/gemma-4-31b-it
GEMMA_API_KEY=               # falls back to FIREWORKS_API_KEY if empty
GEMMA_4_ENDPOINT=            # falls back to Fireworks inference URL if empty
```

The health endpoint reports `gemma4Configured: true` when `GEMMA_4_DEPLOYMENT` or `GEMMA_4_ENDPOINT` is set.

---

## 4. Project Structure

```
src/
  app/
    api/
      agent/route.ts           # Main chat/agent orchestrator
      agent/run/route.ts       # GET run status / all runs
      agent/events/route.ts    # SSE endpoint for live agent events
      agent/upload/route.ts    # Image OCR
      health/route.ts          # Health + model config status
      library/route.ts         # CRUD for subjects/topics/materials
      profile/route.ts         # Learner profile CRUD
      quiz/route.ts            # Quiz submission + progress update
      seed/route.ts            # Seed DB + demo user
      topic/[id]/route.ts      # Fetch topic + materials
    chat/page.tsx              # Main chat UI
    topic/[id]/page.tsx        # Study pack view
    library/page.tsx           # Personal library
    profile/page.tsx           # Learner profile view
    deck/page.tsx              # Flashcard deck view
    demo/page.tsx              # Demo landing
    page.tsx                   # Home landing
  components/
    MarkdownRenderer.tsx       # Custom lightweight markdown parser
    chat/
      InteractiveMessage.tsx   # Routes to interactive widgets
      AgentActivity.tsx        # Live agent step timeline
      widgets/
        FlashcardDeck.tsx
        MiniQuiz.tsx
        InfoCards.tsx
        ComparisonTable.tsx
        StudyPackActions.tsx
  lib/
    agents.ts                  # Agent prompts + logic
    agent-events.ts            # In-memory event store for observability
    fireworks.ts               # LLM client + Gemma resolution
    supabase.ts                # Supabase admin client
    types.ts                   # Shared TypeScript types
scripts/
  smoke-test.js               # Integration smoke tests
  warmup-gemma4.js            # Pre-demo Gemma 4 warmup
supabase/migrations/001_initial.sql  # DB schema + seeds
```

---

## 5. Database Schema

### Tables

- `users` — `id TEXT PRIMARY KEY`, `name`, `created_at`. Demo user: `demo-user-id`.
- `learner_profiles` — per-user JSONB fields: `language_confidence`, `learning_style`, `strengths`, `weaknesses`, `study_habits`.
- `subjects` — per user, e.g. "Science", "Math".
- `topics` — per subject, e.g. "Photosynthesis". Stores `curriculum_match`, `progress`, `last_studied_at`.
- `materials` — per topic, types: `original_notes`, `clean_notes`, `reviewer`, `flashcards`, `quiz`, `summary`, `story`, `image_notes`. Content is JSONB.
- `messages` — chat history per user/topic.
- `curriculum_items` — seeded Grade 9 competencies.

### Important seeds

- Demo user `demo-user-id` / name "Prince".
- Grade 9 curriculum items for Photosynthesis, Cellular Respiration, Ecosystem, Factoring, Quadratic Equations, Quadratic Formula, Point of View, Characterization, Irony.

---

## 6. Agent Orchestration (`src/app/api/agent/route.ts`)

On every message the backend runs this pipeline and emits events (see `AgentActivity.tsx`):

1. **Start** — log request.
2. **Profile/History** — load last 10 messages.
3. **Classifier Agent** — detect subject, subcategory, topic, intent, language.
   - Intents: `teach_topic`, `create_study_pack`, `make_flashcards`, `make_reviewer`, `make_quiz`, `make_story`, `retrieve_material`, `continue_learning`, `unknown`.
   - Quiz follow-ups keep the quiz topic instead of re-classifying (fixed 2026-07-10).
4. **Curriculum Agent** — align to Grade 9 competency (DB lookup, then LLM fallback).
5. **Subject/Topic** — find or create subject & topic (case-insensitive).
6. **Save user message** to `messages`.
7. **Retrieve** existing materials if intent is retrieval.
8. **Create materials** if intent is `create_study_pack` or missing material requested.
   - Calls `materialCreatorAgent` → `StudyPack` (clean_notes, reviewer, flashcards, quiz, summary, story).
   - Saves/updates all material types in `materials` table.
9. **Teaching Agent** — crafts personalized reply using profile, history, study pack, quiz result.
10. **Save assistant reply** to `messages`.
11. **Memory Agent** — background update of `learner_profiles`.

### Interactive payloads

`visualDesignerAgent` returns interactive widgets **only on explicit request**:
- `flashcards` — if message mentions flashcards.
- `quiz` — if message mentions quiz/test/questions.
- `comparison_table` — if message mentions table/compare/vs.
- `info_cards` — if message mentions visual/diagram/chart.
- No default widget is shown for generic `create_study_pack`.

---

## 7. Agent Prompts (`src/lib/agents.ts`)

### classifierAgent
Returns JSON: subject, subcategory, topic, intent, language_detected, confidence.

### curriculumAgent
Returns JSON: grade_level, subject, subcategory, topic, competency, previous_topic, next_topic.

### materialCreatorAgent
Returns JSON StudyPack with clean_notes, reviewer, flashcards[], quiz[], summary, story.

### teachingAgent
Crafts the final reply. Key rules:
- Respond in the language the student used.
- Adapt to `learning_style`, `strengths`, `weaknesses`.
- Be encouraging for struggling students; go deeper for advanced students.
- Do NOT give away quiz answers on wrong attempts; give hints instead.
- Include English academic term at least once when replying in Filipino/Cebuano.
- End with one guiding question.
- Does NOT push flashcards/quiz unless the student explicitly asked for them.

### memoryAgent
Updates learner profile fields from one interaction.

---

## 8. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | DB readiness + model config |
| `/api/seed` | POST | Seed DB + demo user |
| `/api/agent` | POST | Main chat/agent pipeline |
| `/api/agent/run?requestId=...` | GET | Get run events/status |
| `/api/agent/events?requestId=...` | GET | SSE stream of run events |
| `/api/agent/upload` | POST | Image OCR (multipart: `userId`, `image` as data URL) |
| `/api/profile` | GET/PUT | Learner profile |
| `/api/library` | GET/POST/PUT/DELETE | Subjects/topics/materials |
| `/api/quiz` | POST | Submit quiz answer, update progress |
| `/api/topic/[id]` | GET | Topic + materials |

---

## 9. Frontend Pages

### `/chat`
- Main chat UI.
- Model selector: `Auto (DeepSeek/Kimi)` or `Gemma 4 (demo only — paid)`.
- Camera upload button (opens camera modal or file input).
- Live `AgentActivity` panel appears during a run.
- Interactive widgets render below assistant messages when returned.
- "View study pack →" link shown when materials were created.

### `/topic/[id]?userId=...`
- Shows all materials for a topic: clean notes, reviewer, flashcards, quiz, summary, story.

### `/library`
- Folder-style organization of subjects, topics, materials.

### `/profile`
- Learner profile view.

---

## 10. Model Switching & Gemma 4

- The `model` parameter in `/api/agent` body can be `"auto"` or `"gemma-4"`.
- `fireworks.ts::resolveGemmaConfig` maps `"gemma-4"` to the on-demand deployment.
- If Gemma 4 fails, `callFireworks` falls back to the default serverless model automatically.
- UI shows a purple "Gemma 4 active" badge when configured, amber "Fallback" otherwise.

### Cost / operational notes

- Fireworks on-demand H200: **$7/hour while active**.
- Deployment `ymlz8joa` is configured with `minReplicaCount=1` while testing/warming.
- For demo: warm up before, run with `min=1`, then scale to zero or delete after.
- Estimated demo cost: ~$7–14 for 1–2 hours.
- Current Fireworks credit: ~$56 (subject to change; check billing dashboard).

### Warmup command

```bash
node scripts/warmup-gemma4.js
```

Run this 2–3 minutes before a Gemma 4 demo to avoid cold-start latency.

---

## 11. Testing

### Smoke tests

```bash
npm run smoke-test
```

Tests: health, seed, profile, agent response, library, flashcards, topic, quiz, profile update, folder CRUD.

### Manual API tests

Explain topic (no materials created):
```bash
curl -s -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo-user-id","message":"explain photosynthesis","requestId":"test-1","model":"auto"}'
```

Make flashcards (interactive widget returned):
```bash
curl -s -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo-user-id","message":"make flashcards for photosynthesis","requestId":"test-2","model":"auto"}'
```

Gemma 4:
```bash
curl -s -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo-user-id","message":"explain photosynthesis","requestId":"test-g4","model":"gemma-4"}'
```

---

## 12. Known Issues & Gotchas

1. **User must exist in `users` table.** New user IDs will cause FK errors until seeded/created.
2. **Supabase Node.js 20 warning** is harmless but noisy.
3. **Gemma 4 deployment cold start** can take 1–3 minutes if scaled to zero.
4. **`next start` + `output: standalone`** warning is harmless for local demos.
5. **Agent Activity panel** keeps polling after a run finishes because `activeRequestId` is not cleared; acceptable for demo.
6. **Image OCR** uses Fireworks vision model; quality depends on photo clarity.
7. **On Windows**, run commands via Git Bash and use `/c/Users/Admin/nodejs/npm` or add Node to PATH.

---

## 13. Submission Context (lablab.ai AMD Developer Hackathon: ACT II)

- **Organizer:** lablab.ai + AMD
- **Dates:** July 6–11, 2026
- **Tracks:** beginner routing agent, video-captioning pipeline, open **Unicorn** track (creativity, originality, product potential)
- **Gemma challenge:** "Best Use of Gemma Models" — using Gemma 4 satisfies this.
- **Prize pool:** $10,000 total ($5k / $3k / $2k).
- **Submission needs:** project page, working demo, description, tech stack, repo/artifact link, demo video/screenshots.

---

## 14. Recent Changes Log

- Removed VoiceModal/TTS feature (not Gemini-like enough).
- Added live Agent Activity panel.
- Made interactive widgets on-demand only.
- Improved MarkdownRenderer bold/italic and numbered-list handling.
- Fixed quiz follow-up topic drift.
- Removed Gemma 3 from UI; kept Gemma 4 toggle with cost warning.
- Added `scripts/warmup-gemma4.js`.
- Verified Gemma 4 31B deployment `ymlz8joa` responds in ~3–4s after warmup.

---

## 15. Quick Commands

```bash
# Install (if needed)
/c/Users/Admin/nodejs/npm install

# Lint + build
npm run lint
npm run build

# Start production server
npm start

# Smoke test
npm run smoke-test

# Warm Gemma 4
node scripts/warmup-gemma4.js
```

---

*Last updated: 2026-07-10. Keep this file current whenever architecture, env vars, or major behavior changes.*
