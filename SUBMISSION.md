# PADAYON — LabLab.ai / AMD Developer Hackathon: ACT II Submission Kit

## Submission URL
https://lablab.ai/event/amd-developer-hackathon-act-ii

## Track
**Unicorn Track** — product/startup-oriented project

Also competing for: **Best AMD-Hosted Gemma Project** ($2,000)

## Basic Information

### Project Title
PADAYON — AI Learning Partner for Filipino Students

### Short Description (≤ 150 words)
PADAYON turns messy student notes, photos, and questions into organized, curriculum-aligned study materials. It teaches Filipino students through translanguaging — Cebuano or Filipino first, then academic English — and remembers each learner's strengths, weaknesses, and progress across sessions. Built as a multi-agent system on Fireworks AI with Gemma 4 on AMD hardware.

### Long Description
PADAYON is an AI learning partner designed for Filipino students who struggle with academic English, disorganized notes, and last-minute studying. Instead of simply answering questions, PADAYON organizes what the student gives it, aligns it to the Philippine curriculum, generates flashcards/quizzes/reviewers/summaries/stories, teaches in the learner's strongest language first, and tracks mastery over time.

The backend runs seven specialized agents — Classifier, Curriculum Alignment, Organizer, Material Creator, Teaching, Assessment, and Memory — orchestrated through the Fireworks AI API. A chat toggle lets users switch to Gemma 4 31B Instruct for the demo, with automatic fallback to serverless models if the deployment is scaled down.

The result is a working demo that shows real AI use in education: not shortcut answers, but structured, personalized learning.

### Technology Tags
Next.js, Supabase, Tailwind CSS, Fireworks AI, Gemma, AMD Developer Cloud, Docker, AI Agents

### Category Tags
Education, EdTech, AI Agents, Natural Language Processing, Multilingual AI

---

## Cover Image
Use `screenshots/padayon_home.png` or the first slide of `PADAYON_Pitch_Deck.pptx`.

## Slide Presentation
`PADAYON_Pitch_Deck.pptx` — 12 slides covering problem, solution, architecture, demo flow, Gemma/AMD integration, market potential, and links.

## Video Presentation (recommended)
Record a 2–3 minute screen demo using the live app:
- Show messy notes → organized topic
- Show Cebuano-first explanation
- Show library with auto-generated materials
- Show learning profile updates
- Show Gemma toggle in the chat header
- End with the live URL and GitHub link

## Public GitHub Repository
https://github.com/pjmorales1123/padayon

## Demo Application URL
https://courtesy-bacon-post-internet.trycloudflare.com

> Note: Cloudflare quick tunnels are temporary. For a permanent demo link, deploy to Vercel or run the Docker container on a persistent host.

---

## Key Pitch Points

1. **Real problem, real data**
   - PISA 2022: Philippines ranked 77/81; scores 347 reading, 355 math, 356 science vs OECD ~472–485.
   - English-medium instruction in Science/Math is a documented barrier; MTB-MLE research shows mother-tongue-first learning improves comprehension.
   - 85% of students already use AI for schoolwork, mostly for shortcuts; PADAYON redirects that habit toward real learning.

2. **Complete working demo**
   - Multi-agent backend, persistent memory, auto-organization, material generation, quiz scoring, mastery tracking.
   - Live at the URL above.

3. **Strong use of AMD / Fireworks / Gemma**
   - Fireworks AI serverless models for fast fallback.
   - Gemma 4 31B Instruct toggle for high-quality teaching demo.
   - Docker containerized per submission requirements.

4. **Differentiation**
   - Translanguaging + curriculum alignment + long-term memory in one simple chat.
   - Most AI education tools answer; PADAYON teaches and organizes.

---

## Demo Script for Video (2–3 min)

1. **Home screen**: "PADAYON is an AI study partner for Filipino students."
2. **Messy notes**: Type `photosynthesis chlorophyll sunlight CO2 oxygen glucose food important`.
3. **Agent pipeline**: Watch the classifier detect Science → Biology → Photosynthesis, align to Grade 9 curriculum, and create materials.
4. **Library**: Open Library to see the topic, progress bar, and generated tabs.
5. **Translanguaging**: Ask `unsa diay ang photosynthesis?` and show Cebuano-first response.
6. **Gemma toggle**: Switch the model dropdown to Gemma 4 and explain it runs on AMD/Fireworks infrastructure.
7. **Profile**: Show the learning profile with updated strengths, weaknesses, and language confidence.
8. **Retrieval**: Start a new chat and ask `show my flashcards`.
9. **CTA**: Show GitHub repo and live URL.

---

## Quick Commands for Demo Day

```bash
# Start the app
cd /c/Users/Admin/padayon
npm start

# Start tunnel (in another terminal)
./cloudflared.exe tunnel --url http://localhost:3000

# Scale up Gemma 4 before demo
node scripts/gemma4-scale.js up
# Wait 2–4 minutes until READY
node scripts/gemma4-scale.js status

# Scale down after demo to save credits
node scripts/gemma4-scale.js down
```

---

## Submission Checklist
- [x] Public GitHub repo with README
- [x] Dockerfile + .dockerignore
- [x] Working demo URL
- [x] Slide presentation (PPTX)
- [x] Cover image
- [ ] Video presentation (record on demo day)
- [ ] Submit on lablab.ai before deadline
