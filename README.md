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
- Auto-generation of clean notes, reviewer, flashcards, quiz, and summary
- Translanguaging teaching (e.g., Cebuano-first, then academic English)
- Persistent memory that grows with the learner
- Retrieval of saved materials across sessions
- Quiz submission with real score tracking and progress visualization
- Editable learner profile (name, language confidence, learning style, strengths, weaknesses)
- Conversation history awareness for more coherent teaching responses

## How it uses AMD / Fireworks / Gemma

- **AI Runtime:** Fireworks AI API
- **Primary Model:** Gemma 3 27B Instruct (via Fireworks) — used when serverless access is available
- **Fallback Model:** `deepseek-v4-flash` — tested to return strict JSON for classifier, curriculum, material creator, and memory agents
- **Architecture:** Separate agent prompts sent to Fireworks for classification, curriculum alignment, material creation, teaching, and memory updates
- **Last Resort Fallback:** Seeded demo responses if both models fail

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
2. Copy `.env.local` and fill in your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   FIREWORKS_API_KEY=
   FIREWORKS_MODEL=accounts/fireworks/models/gemma-3-27b-it
   FIREWORKS_FALLBACK_MODEL=accounts/fireworks/models/deepseek-v4-flash
   ```
3. Run the database migrations. You have two options:
   - **Option A:** Open `supabase/migrations/001_initial.sql` in the Supabase dashboard SQL editor and run it.
   - **Option B:** From a machine with direct Postgres access, run:
     ```
     set DATABASE_URL=postgresql://user:password@host:5432/db
     npm run migrate
     ```
4. Seed the curriculum and demo user:
   ```
   POST /api/seed
   { "userId": "demo-user-id" }
   ```
5. Install dependencies:
   ```
   npm install
   ```
6. Run the dev server:
   ```
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
| `FIREWORKS_MODEL` | Model ID (default: Gemma 3 27B) |
| `FIREWORKS_FALLBACK_MODEL` | Fallback model ID when Gemma isn't accessible (default: deepseek-v4-flash) |

## Demo Flow

1. **Messy Notes:** Student types `photosynthesis chlorophyll sunlight CO2 oxygen glucose food important`
2. **Organization:** AI detects Science → Biology → Photosynthesis and saves it
3. **Materials:** AI creates clean notes, reviewer, flashcards, and quiz
4. **Library:** Student views saved topic and materials in the Library
5. **Translanguaging:** Student asks `unsa diay ang photosynthesis?` and gets Cebuano-first explanation
6. **Retrieval:** Student starts new chat and says `show my flashcards` — saved flashcards are retrieved
7. **Quiz:** Student takes the quiz; score is saved and progress is updated
8. **Profile:** Learning profile shows updated language confidence, strengths, weaknesses, and can be edited

## Tech Stack

- Next.js (App Router)
- Tailwind CSS
- Supabase (Postgres)
- Fireworks AI API (Gemma 3 27B Instruct)
- Vercel (hosting)
- Docker (submission)

## Submission

Build the Docker image:
```
docker build -t padayon .
docker run -p 3000:3000 padayon
```
