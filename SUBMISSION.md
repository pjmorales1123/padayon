# Lablab.ai Submission — PADAYON

> Fill these fields on the [lablab.ai submission page](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii).

## Basic Information

- **Project Title:** PADAYON
- **Short Description:** AI study partner that turns messy student notes into organized, curriculum-aligned learning materials.
- **Long Description:** PADAYON is an agentic AI learning partner for Filipino students. It classifies student input, aligns it to the Grade 9 curriculum (Budget of Work), and automatically generates clean notes, flashcards, quizzes, summaries, and stories. It teaches in the student's strongest language — Cebuano, Filipino, or English — and remembers their strengths, weaknesses, and learning style across sessions. A live backend agent monitor shows judges exactly what each agent is doing and has done. Students can snap photos of handwritten notes with the camera and switch between Gemma 4 (demo-only, on-demand) and auto fallback.
- **Technology Tags:** Next.js, React, TypeScript, Tailwind CSS, Supabase, Fireworks AI, Gemma 4, AMD Developer Cloud, Docker, AI Agents
- **Category:** AI Agents, Education, EdTech, Multilingual AI

## Application URLs

- **Live Demo:** https://courtesy-bacon-post-internet.trycloudflare.com
- **Pitch Deck:** https://courtesy-bacon-post-internet.trycloudflare.com/deck
- **Interactive Demo:** https://courtesy-bacon-post-internet.trycloudflare.com/demo
- **Public GitHub Repository:** https://github.com/pjmorales1123/padayon

## Submission Files

- **Cover Image:** `public/screenshots/02-demo-with-events.png` — 1920×895 screenshot of `/demo` showing Gemma 4 active, the chat reply, and the live backend agent monitor at 91% pipeline progress.
- **Demo Video:** *(record 2–3 minutes following `DEMO_SCRIPT.md`, upload to YouTube or Loom)*
- **Slide Presentation:** use `/deck` or export screenshots from it

## Track

- **Primary Track:** Track 3 — Unicorn Track
- **Award Target:** Best AMD-Hosted Gemma Project ($2,000)

## Key Points for the Pitch

1. **Real problem:** Filipino students struggle with disorganized notes and academic English.
2. **Agentic solution:** Classifier, curriculum, material creator, teacher, and memory agents work together.
3. **Transparency:** Live agent monitor shows judges exactly what the AI is doing.
4. **Multilingual:** Translanguaging support for Cebuano and Filipino.
5. **Gemma 4:** On-demand deployment via Fireworks, with automatic fallback.
6. **Market:** 28M+ students in the Philippines; scalable to other multilingual markets.

## What Judges Will See

1. Open `/` — clean landing page with feature grid.
2. Open `/demo` — chat + live backend agent pipeline with per-agent status.
3. Select **Gemma 4** in the chat header.
4. Try prompts like:
   - "Explain photosynthesis like I'm 10"
   - "Make flashcards for photosynthesis"
   - "Unsa ang photosynthesis? Dili ko kasabot sa English."
5. Use the **📷 camera button** to snap or upload handwritten notes.
6. Watch the right-hand monitor show each agent's current task and completed work.
7. Open `/deck` for the pitch slides.

## Post-Submission Note

The Cloudflare tunnel URL is temporary. For a permanent submission URL, deploy the Docker container to Vercel, Render, Railway, or Google Cloud Run before judging begins.
