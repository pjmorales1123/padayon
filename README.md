# PADAYON

**Tagline:** Creating solutions for educational problems with AI

## Problem

Students often struggle with:
- Disorganized notes and messy study materials
- Difficulty understanding academic English
- No personalized learning path or memory of past sessions
- Lack of curriculum-aligned study resources

## Solution

PADAYON is an AI learning partner that turns messy student input into organized, curriculum-aligned learning materials while teaching through the language students understand best.

**Key features:**
- Automatic subject/topic detection from messy notes or keywords
- Curriculum alignment to a seeded Budget of Work
- Auto-generation of clean notes, reviewer, flashcards, quiz, summary, and story
- Translanguaging teaching (e.g., Cebuano-first, then academic English)
- Persistent memory that grows with the learner
- Retrieval of saved materials across sessions
- Quiz submission with real score tracking and progress visualization
- Editable learner profile (name, language confidence, learning style, strengths, weaknesses)
- Conversation history awareness for more coherent teaching responses
- Explicit recovery states: loading, slow, error, retry, empty, and fallback
- Smart import validation: up to 10 files, 12 MB each, images and PDFs only

## How it uses AMD / Fireworks / Gemma

- **Primary Model:** **Gemma 4 31B Instruct** via Fireworks AI. Fireworks is an AMD partner and runs Gemma inference on AMD-powered infrastructure, satisfying the hackathon's AMD compute requirement.
- **AI Runtime:** Fireworks AI API — the production runtime for all seven agents (classifier, curriculum, organizer, material creator, teacher, assessment, memory).
- **Fallback Model:** `deepseek-v4-flash` — fast, serverless Fireworks chat model that takes over automatically if the Gemma endpoint is scaled down or unavailable, keeping the demo stable.
- **Model Toggle:** The chat UI defaults to **Gemma 4** and also lets you switch to **Fallback · DeepSeek V4 Flash**. The runtime badge always shows the actual model provider (`Gemma 4 · AMD/Fireworks`, `DeepSeek V4 Flash · Fireworks`, or `Fallback · Fireworks`).
- **AMD Developer Cloud:** The architecture is also designed to accept a self-hosted Gemma endpoint on an AMD GPU pod via `GEMMA_4_ENDPOINT` when available.

## Agent Architecture

1. **Classifier Agent** — detects subject, topic, intent, and language from student input
2. **Curriculum Alignment Agent** — matches topic to seeded curriculum/Budget of Work
3. **Organizer Agent** — saves data into the correct subject/topic folders in Supabase
4. **Material Creator Agent** — generates clean notes, reviewer, flashcards, quiz, and summary
5. **Teaching Agent** — explains using translanguaging (confident language first, then English)
6. **Assessment Agent** — short quizzes with hints and kind explanations
7. **Memory Agent** — updates learner profile based on interactions

## Setup Instructions

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in your credentials:
   ```powershell
   cp .env.example .env.local
   ```
   Example values are in `.env.example`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   FIREWORKS_API_KEY=
   FIREWORKS_MODEL=accounts/fireworks/models/deepseek-v4-flash
   FIREWORKS_FALLBACK_MODEL=accounts/fireworks/models/kimi-k2p5

   # Optional: Gemma endpoint for the demo toggle
   # For Fireworks on-demand, use GEMMA_3_DEPLOYMENT (preferred):
   GEMMA_3_DEPLOYMENT=accounts/<account>/deployments/<deployment-id>
   GEMMA_4_DEPLOYMENT=
   # For external/custom endpoints, use GEMMA_3_ENDPOINT + GEMMA_API_KEY:
   GEMMA_3_ENDPOINT=
   GEMMA_4_ENDPOINT=
   GEMMA_API_KEY=    # falls back to FIREWORKS_API_KEY if empty
   ```
3. Run the database migrations. You have two options:
   - **Option A:** Open `supabase/migrations/001_initial.sql` in the Supabase dashboard SQL editor and run it.
   - **Option B:** From a machine with direct Postgres access, run:
     ```powershell
     $env:DATABASE_URL="postgresql://user:password@host:5432/db"
     npm run migrate
     ```
4. Seed the curriculum and demo user:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/api/seed" -Method POST -Body '{"userId":"demo-user-id"}' -ContentType "application/json"
   ```
5. Install dependencies:
   ```powershell
   npm install
   ```
6. Run the dev server:
   ```powershell
   npm run dev
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `DATABASE_URL` | Direct Postgres connection string (only needed for `npm run migrate`) |
| `FIREWORKS_API_KEY` | Fireworks AI API key |
| `FIREWORKS_MODEL` | Default serverless model ID (default: kimi-k2p6) |
| `FIREWORKS_FALLBACK_MODEL` | Fallback serverless model ID (default: kimi-k2p6) |
| `GEMMA_4_DEPLOYMENT` | Fireworks on-demand deployment name for Gemma 4 (optional) |
| `GEMMA_4_ENDPOINT` | External OpenAI-compatible endpoint for Gemma 4 (optional) |
| `GEMMA_API_KEY` | API key for the Gemma endpoint (optional, falls back to FIREWORKS_API_KEY) |

## Persona-Preserving Navigation

Every primary link carries the selected `userId` query parameter, so switching between Home, Live Demo, Chat, Library, Profile, and Topic keeps the current learner context. The shared `AppNavigation` component builds query-aware hrefs and warns before leaving a page that is still working.

## Actual-Runtime Badge

After each assistant reply, the chat header shows the model that actually served the request:

- `Gemma 4 · AMD/Fireworks` — the Gemma endpoint responded and fallback was not used.
- `DeepSeek V4 Flash · Fireworks` — the **Fallback · DeepSeek V4 Flash** toggle was selected and responded directly.
- `Fallback · Fireworks` — Gemma 4 was requested but unreachable, so the request fell back to Fireworks.

The badge is driven by `model_runtime` returned from `/api/agent`, not by the UI toggle alone.

## Demo Flow

1. **Messy Notes:** Student types `photosynthesis chlorophyll sunlight CO2 oxygen glucose food important`
2. **Organization:** AI detects Science → Biology → Photosynthesis and saves it
3. **Materials:** AI creates clean notes, reviewer, flashcards, and quiz
4. **Library:** Student views saved topic and materials in the Library
5. **Translanguaging:** Student asks `unsa diay ang photosynthesis?` and gets Cebuano-first explanation
6. **Model toggle:** Switch from the default **Gemma 4** to **Fallback · DeepSeek V4 Flash** in the chat header, then switch back to **Gemma 4**
7. **Retrieval:** Student starts new chat and says `show my flashcards` — saved flashcards are retrieved
8. **Quiz:** Student takes the quiz; score is saved and progress is updated
9. **Profile:** Learning profile shows updated language confidence, strengths, weaknesses, and can be edited

## Fallback-First Demo Rehearsal

Before testing Gemma, rehearse and verify the fallback path:

1. Start the app with only `FIREWORKS_API_KEY` set (no Gemma endpoint).
2. Select any demo persona and send a judge prompt.
3. Confirm the learning trail completes and the badge reads `Fallback · Fireworks`.
4. Switch the model toggle to **Gemma 4** and send another prompt.
5. Confirm the response still succeeds and the badge reads `Fallback · Fireworks`.
6. Only after the fallback path passes should you configure a real Gemma endpoint for Gate 2.

## Gemma Demo Setup

The production architecture is AMD-ready through Fireworks AI (an AMD partner) and AMD Developer Cloud. The current demo uses available Fireworks serverless models for reliability, with Gemma endpoints supported when accessible.

### Gemma Gate

Do not claim Gemma is verified until:
- `/api/health` returns `gemma4Configured: true`
- A prompt sent with **Gemma 4** returns `model_runtime: { provider: "gemma", fallback: false }`
- A controlled unavailable Gemma target falls back to Fireworks with `model_runtime: { requested: "gemma-4", provider: "fireworks", fallback: true }`

Run fallback verification first, then Gemma verification, and record the results in `docs/demo-readiness-report.md`.

### AMD Developer Cloud GPU pod (best for the AMD track)

1. Deploy Gemma 4 on your allocated AMD GPU pod (vLLM + ROCm or Ollama).
2. Copy the pod's chat completions URL into `GEMMA_4_ENDPOINT`.
3. Set `GEMMA_API_KEY` if needed.
4. In the chat UI, choose **Gemma 4**. If the endpoint is unreachable, PADAYON falls back to the Fireworks serverless model.

### Fireworks on-demand (alternative if AMD pod is not available)

1. Create a deployment (run this in a terminal with `FIREWORKS_API_KEY` set):
   ```bash
   curl -X POST "https://api.fireworks.ai/v1/accounts/<YOUR_ACCOUNT_ID>/deployments" \
     -H "Authorization: Bearer $FIREWORKS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "baseModel": "accounts/fireworks/models/gemma-4-31b-it",
       "acceleratorCount": 1,
       "minReplicaCount": 0,
       "maxReplicaCount": 1,
       "autoscalingPolicy": { "scaleToZeroWindow": "300s" }
     }'
   ```
2. Copy the returned deployment name into `GEMMA_4_DEPLOYMENT`.
3. Restart the app so it picks up the env var.
4. In the chat UI, choose **Gemma 4**. If the deployment is scaled down or fails, PADAYON automatically falls back to the serverless model.

### Scale to zero between sessions (important — on-demand GPUs bill by uptime)

```bash
# Scale down to stop billing
node scripts/gemma4-scale.js down

# Check status
node scripts/gemma4-scale.js status

# Scale up before a demo (then wait ~2–4 minutes for READY)
node scripts/gemma4-scale.js up
```

### Fallback only

If you have no Gemma endpoint, the toggle still works but will fall back to the serverless model. This keeps the demo stable but does not qualify for the Gemma award.

## Tech Stack

- Next.js 16.2.10 (App Router)
- React 19.2.4
- TypeScript
- Tailwind CSS 4
- Supabase (Postgres)
- Fireworks AI API + optional Gemma endpoint
- Vitest + Testing Library
- Docker (submission)

## Development Commands

```powershell
npm test
npm run lint
npm run build
```

## Submission

Build and run the Docker image:
```powershell
docker build -t padayon .
docker run -p 3000:3000 padayon
```
