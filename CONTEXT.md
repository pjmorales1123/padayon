# PADAYON — Project Context

## What this app is

PADAYON is an AI learning partner for Filipino Grade 9 students. Students chat with the app to:

- Create organized study packs (clean notes, reviewer, flashcards, quiz, summary, story)
- Upload photos or PDFs of class notes and get them turned into study materials
- Ask follow-up questions, request visuals, summaries, and flashcards
- Track progress in a personal Library

Live URL: `https://padayon-theta.vercel.app`

## Tech stack

- Next.js 16.2.10 (App Router, Turbopack)
- React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Postgres + auth-ish via demo user IDs)
- Fireworks AI for LLM inference

## Model split

- **Chat / reasoning:** `accounts/fireworks/models/deepseek-v4-flash` (fast, cheap)
- **Vision / OCR:** `accounts/fireworks/models/kimi-k2p6` (only serverless vision model available on this Fireworks account)
- **On-demand demos:** Gemma 4 deployment scaled up/down via `scripts/gemma4-scale.js`

## Key source files

| File | Responsibility |
|------|----------------|
| `src/app/api/agent/route.ts` | Main orchestrator. Classifies intent, finds/creates subject & topic, calls agents, saves reply. |
| `src/lib/agents.ts` | All agent functions: classifier, curriculum, research, material creator, teaching, memory, visual designer, student reply review. |
| `src/lib/fireworks.ts` | Fireworks API client + vision call + OCR output cleanup. |
| `src/features/chat/ChatWorkspace.tsx` | Chat UI, upload/OCR client-side, sends `topicId` with requests. |
| `src/app/library/page.tsx` | Library UI with topic badges (image/pdf counts, reviewer/flashcards/quiz). |
| `src/app/topic/[id]/page.tsx` | Topic detail with tabs: Overview, Uploads, Original Notes, Clean Notes, Reviewer, Flashcards, Quiz, Story, Progress. |
| `src/app/api/agent/upload/route.ts` | Server-side image OCR + duplicate detection via SHA-256. |
| `src/lib/agent-routing.ts` | Helpers for reply history, upload confirmation, upload material content, topic persistence rules. |

## Recent architectural changes

### 1. Topic context follow-ups (`topicId`)

**Problem:** Follow-ups like "show me a visual" or "make flashcards" were falling back to the *last active topic in the database*, which could be a different topic than the one the student just created or opened.

**Fix:**
- `ChatWorkspace` now tracks `currentTopicId` and sends it with every `/api/agent` request.
- `src/app/api/agent/route.ts` accepts `topicId`. When provided, the route locks classification/subject/topic to the provided topic instead of classifying from the short follow-up message.
- This makes visual generation, flashcards, summary, and clean-notes requests stay in the current conversation context.

### 2. Student Helpfulness Reviewer (demo "thinking mode")

**Problem:** Agent replies sometimes hallucinate ("you already learned this"), ask irrelevant questions, use overly complex language, use confusing examples, or use Bisaya/Cebuano words that are too deep.

**Fix:**
- Added `studentReplyReview` in `src/lib/agents.ts`.
- It runs once per student-facing reply (after all agents, before saving) and returns an `improved_reply` JSON field.
- It checks for: unverified claims, irrelevant questions, complexity mismatches, confusing/non-relatable examples, overly deep local language, hallucinations, and tone issues.
- It is skipped only for deterministic study-pack confirmations.

### 3. OCR cleanup for Kimi k2.6

**Problem:** `kimi-k2p6` outputs its own chain-of-thought mixed with the transcription.

**Fix:**
- The upload prompt asks for a numbered list.
- `cleanVisionOutput` in `src/lib/fireworks.ts` extracts numbered lines when present and falls back to stripping known meta-commentary patterns.
- Full extracted text is now stored in `image_notes` / `pdf_notes` material content, so the Topic Uploads tab shows both the image preview and the processed text.

### 4. Auto-create study pack on upload

- When a student uploads an image/PDF, the app OCRs it, saves the upload material, and auto-generates clean notes, reviewer, flashcards, quiz, summary, and story from the extracted text.

### 5. Library badges

- Library cards show badges for image/PDF counts and whether reviewer, flashcards, and quiz exist.

## Testing notes

Tested live API flows (2026-07-12):

- Image upload + OCR → clean text extracted
- Upload → study pack auto-create (clean_notes, reviewer, flashcards, quiz, summary, story, image_notes)
- `topicId` follow-ups: visual generation (`html_visual`), flashcards, summary, clean notes all stay on the same topic
- PDF upload (simulated by rendering pages to images) → `pdf_notes` with preview image and extracted text
- Library returns one subject/topic with all material types
- Topic detail returns `image_notes` with `image_url` + full text, plus clean notes, summary, flashcards, etc.

## Demo prep reminders

- Scale Gemma 4 up ~5 minutes before a warm demo: `node scripts/gemma4-scale.js up`
- Demo materials are in `C:\Users\Prince\Documents\PADAYON Demo Materials`
- Demo script DOCX: `PADAYON Live Demo Script.docx`

## Environment variables (production)

- `FIREWORKS_API_KEY`
- `GEMMA_4_DEPLOYMENT`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

(These are encrypted in Vercel; do not hardcode in source.)
