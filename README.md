# PADAYON

AI learning partner for Filipino students.

PADAYON turns messy notes, uploaded photos, PDFs, and student questions into organized, curriculum-aligned study materials. It teaches through translanguaging, remembers learner progress, and shows which major AI runtime handled each response.

## Live Links

- Live demo: https://padayon-theta.vercel.app
- GitHub repository: https://github.com/pjmorales1123/padayon
- Usage guide: [docs/USAGE_GUIDE.md](docs/USAGE_GUIDE.md)
- Demo readiness notes: [docs/demo-readiness-report.md](docs/demo-readiness-report.md)

## Why It Matters

Many Filipino students study in English even when they understand lessons better first in Cebuano, Filipino, or another local language. They also use AI tools already, but often for shortcut answers instead of durable learning.

PADAYON redirects that behavior into a guided study workflow:

- organize messy notes into subjects and topics
- align topics with a seeded Grade 9 curriculum/Budget of Work
- generate reviewers, clean notes, flashcards, quizzes, stories, summaries, and visual guides
- explain concepts in the learner's strongest language first, then connect back to academic English
- track confidence, quiz scores, strengths, weaknesses, and topic progress over time

## Core Features

- Chat-based learning assistant with image/PDF upload support
- Automatic topic detection and curriculum alignment
- Persistent library of generated learning materials
- Learner profiles for demo personas and new users
- Quiz scoring with learner summary updates
- Visual guide generation for visual learners
- Backend agent monitor focused on meaningful agents and actual runtime
- Gemma 4 via Fireworks AI when scaled up, with Fireworks fallback for reliability

## How PADAYON Uses Gemma, Fireworks, and AMD

PADAYON supports Gemma 4 through Fireworks AI on-demand deployments. The app routes chat requests to the configured Gemma deployment when the Gemma toggle is selected and the deployment is ready.

- Primary demo path: `GEMMA_4_DEPLOYMENT` using Fireworks' OpenAI-compatible chat completions endpoint
- Fallback path: `FIREWORKS_MODEL` / `FIREWORKS_FALLBACK_MODEL` for stable demos if Gemma is scaled down or unavailable
- Runtime visibility: the chat UI and backend monitor show whether a response used Gemma or fallback
- Credit safety: `scripts/gemma4-scale.js` can scale Gemma up before a demo and down after testing

## Agent Architecture

PADAYON is organized as a multi-agent learning system:

1. Classifier Agent detects subject, topic, intent, and language.
2. Curriculum Alignment Agent maps the topic to the seeded curriculum.
3. Organizer Agent saves uploaded/source content into the right learner topic.
4. Material Creator Agent builds study materials such as notes, reviewers, flashcards, quizzes, summaries, stories, and visuals.
5. Teaching Agent explains with translanguaging and student-friendly pacing.
6. Assessment Agent handles quiz practice, hints, feedback, and scores.
7. Memory Agent updates learner profile, confidence, strengths, weaknesses, and progress.

The demo monitor intentionally highlights the meaningful learning agents and the actual model runtime instead of noisy internal process steps.

## Quick Start

### 1. Install dependencies

```powershell
cd C:\Users\Admin\padayon
npm install
```

### 2. Configure environment variables

Copy the example file:

```powershell
Copy-Item .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

FIREWORKS_API_KEY=
FIREWORKS_MODEL=accounts/fireworks/models/deepseek-v4-flash
FIREWORKS_FALLBACK_MODEL=accounts/fireworks/models/deepseek-v4-flash
FIREWORKS_VISION_MODEL=accounts/fireworks/models/kimi-k2p6

GEMMA_4_DEPLOYMENT=
GEMMA_4_ENDPOINT=
GEMMA_API_KEY=
```

Never commit real API keys. Keep production secrets in Vercel/Supabase/Fireworks dashboards.

### 3. Set up Supabase

Run the initial migration in the Supabase SQL editor:

```text
supabase/migrations/001_initial.sql
```

Or run it from a machine with direct database access:

```powershell
$env:DATABASE_URL="postgresql://user:password@host:5432/postgres"
npm run migrate
```

Seed demo data while the app is running:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/seed" -Method POST -Body '{"userId":"demo-user-id"}' -ContentType "application/json"
```

### 4. Run locally

```powershell
npm run dev
```

Open http://localhost:3000.

## Demo Walkthrough

Use the full guide in [docs/USAGE_GUIDE.md](docs/USAGE_GUIDE.md). A short judge-friendly flow:

1. Open the live demo and choose or create a learner profile.
2. Upload a photo of notes or type messy notes such as `photosynthesis chlorophyll sunlight CO2 oxygen glucose food important`.
3. Ask PADAYON to explain the topic in Cebuano/Filipino plus English.
4. Ask for flashcards, a quiz, or a visual guide.
5. Open the Library to confirm materials were saved.
6. Take a quiz and check the Learner Summary/Profile updates.
7. Switch to Gemma 4 for the model-runtime demo when the deployment is scaled up.

## Gemma Scaling Commands

Scale Gemma up before a demo:

```powershell
node scripts/gemma4-scale.js up
```

Check readiness:

```powershell
node scripts/gemma4-scale.js status
```

Scale down after testing to save credits:

```powershell
node scripts/gemma4-scale.js down
```

Expected Gemma proof:

- `/api/health` reports Gemma configured
- a Gemma-selected chat response returns runtime provider `gemma`
- if Gemma is unavailable, the response succeeds through Fireworks fallback and the UI says fallback

## Docker

Build and run:

```powershell
docker build -t padayon .
docker run --env-file .env.local -p 3000:3000 padayon
```

For the current PADAYON web submission, the public demo is deployed on Vercel. If a submission form requires a Docker image but the selected track does not require one, use `N/A` and point evaluators to the live Vercel app and public GitHub repository.

## Deployment

PADAYON is designed for Vercel:

1. Import `https://github.com/pjmorales1123/padayon` into Vercel.
2. Add the environment variables from `.env.example`.
3. Confirm Supabase migrations are applied.
4. Deploy the Next.js app.
5. Test upload, chat, material creation, quiz scoring, learner summary updates, and Gemma/fallback runtime labels.

Current demo URL:

```text
https://padayon-theta.vercel.app
```

## Development Commands

```powershell
npm run lint
npm test
npm run build
```

## Submission Notes

Suggested submission fields:

- Title: `PADAYON: AI Learning Partner`
- Short description: `PADAYON helps Filipino students turn messy notes, photos, and questions into curriculum-aligned study materials, quizzes, visuals, and personalized explanations using Gemma, Fireworks AI, and learner memory.`
- Categories: Education, EdTech, AI Agents, Multilingual AI, Natural Language Processing, Student Productivity
- Technologies: Next.js, React, TypeScript, Tailwind CSS, Supabase, Fireworks AI, Gemma 4, AMD-backed inference, Vercel, Docker, Vitest, Testing Library
- Repository: https://github.com/pjmorales1123/padayon
- Demo URL: https://padayon-theta.vercel.app

## License

Hackathon prototype. Add a formal license before broader public reuse.
