# PADAYON — Repeatable Demo Script

**Live URL:** https://padayon-theta.vercel.app  
**Backup URL:** https://courtesy-bacon-post-internet.trycloudflare.com (local tunnel)

## Pre-demo setup (do this 2 minutes before judging)

1. Open https://padayon-theta.vercel.app
2. Click **"Reset personas"** on the home page to seed fresh demo profiles.
3. Open the **Live Demo** or click any persona card.
4. Use the bottom navigation bar to move between Home, Live Demo, Chat, Library, and Profile — the selected learner stays attached to every link.

> Gemma 4 uses the Fireworks on-demand deployment `accounts/princejirehmorales-2/deployments/ymlz8joa`. Scale it up 4–5 minutes before the judged demo moment, use **Auto** for setup/practice, and switch to **Gemma 4** only for the judged run. If Gemma is still warming up or unreachable, the badge truthfully switches to **Fallback · Fireworks** and the demo continues.

---

## The story in 30 seconds

"PISA scores show Filipino students falling behind, and one of the biggest barriers is academic English. Students have messy notes, lose motivation, and use AI just to copy answers. PADAYON is an AI study partner that turns messy notes and lesson PDFs into organized, curriculum-aligned study materials — in the student's own language first, then bridges them to academic English."

---

## Demo flow

### 1. Hook — smart import (the "wow" moment)

**Goal:** Show that PADAYON can ingest real student materials and instantly organize them.

1. Go to **Try the chat**.
2. Click the **paperclip 📎** button.
3. Upload:
   - The 6 sample note photos from `C:\Users\Admin\Documents\IMG_20260629_0802*.jpg`
   - OR the sample PDF `raisin_in_the_sun_lesson (1).pdf`
4. Watch the progress: *"Rendering PDF page 1/6…"* → *"Reading page 1/6…"*
5. PADAYON auto-classifies the subject/topic, aligns to Grade 9 curriculum, and creates:
   - Clean notes
   - Flashcards
   - Quiz
   - Summary
   - Story

**Talking point:** *"This is a real lesson PDF. PADAYON reads it, figures out it's English Literature → A Raisin in the Sun, aligns it to the Grade 9 curriculum, and builds a full study pack. The student didn't have to organize anything."*

---

### 2. Before vs. after — when the app knows you

**Goal:** Show adaptive memory and personalized responses.

#### A. New student — Maria

1. From the home page, click **Maria (Brand new)**.
2. Type: *"Explain photosynthesis"*
3. Expected: Simple English, basic analogy, friendly tone.

**Talking point:** *"Maria is new. PADAYON doesn't know her yet, so it keeps it simple and in English."*

#### B. Cebuano-first learner — Juan

1. From the home page, click **Juan (Cebuano-first)**.
2. Type the same prompt: *"Explain photosynthesis"*
3. Expected: Response in Cebuano/English mix, because his profile says Cebuano: High.

**Talking point:** *"Juan is strong in Cebuano but still learning academic English. PADAYON remembers that and explains in Cebuano first, then gives the English term **photosynthesis**."*

#### C. Advanced English student — Alex

1. Click **Alex (Advanced)**.
2. Type: *"Explain situational irony with a harder example"*
3. Expected: Deeper analysis, more complex example.

**Talking point:** *"Alex is already confident. PADAYON goes deeper instead of dumbing it down."*

#### D. Struggling student — Bea

1. Click **Bea (Needs support)**.
2. Type: *"I don't get quadratic equations. It looks hard."*
3. Expected: Encouraging tone, tiny steps, gentle language.

**Talking point:** *"Bea gets discouraged. PADAYON is warm, breaks the problem into small steps, and doesn't make her feel dumb."*

---

### 3. The backend agent monitor

**Goal:** Make the invisible pipeline visible.

1. Open the **Live Demo**.
2. Send any prompt.
3. Point to the right panel and narrate:
   - **Classifier Agent** → figures out subject, topic, intent
   - **Curriculum Agent** → aligns to Grade 9 competency
   - **Subject/Topic Agent** → organizes the library
   - **Material Creator** → builds flashcards, quiz, summary, story
   - **Teaching Agent** → writes the personalized reply
   - **Memory Agent** → updates strengths, weaknesses, learning style

**Talking point:** *"This isn't one prompt. It's a pipeline of agents working together — and you can see exactly what each one is doing."*

---

### 4. Actual-runtime badge (truthful model labeling)

After each assistant reply, look at the model badge above the message list:

- **Auto · primary** — the default Fireworks serverless model served the request.
- **Gemma 4** — the Gemma endpoint responded and no fallback happened.
- **Fallback · Fireworks** — Gemma was requested but unreachable, so PADAYON fell back to the reliable serverless model.

**Talking point:** *"The badge tells the truth. If Gemma isn't available, we don't fake it — we fall back and show exactly what ran."*

#### Demo switch point

1. With the model selector on **Auto**, send a prompt and note **Auto · primary**.
2. Switch the selector to **Gemma 4** and send the same prompt.
3. If Gemma is configured, the badge reads **Gemma 4**.
4. If Gemma is not configured, the badge reads **Fallback · Fireworks** and the response still works.

---

### 5. Retrieval and continuity

**Goal:** Show that materials persist and can be retrieved later.

1. In any chat, type: *"Show my flashcards"*
2. PADAYON retrieves the saved flashcards for the last active topic.
3. Type: *"Quiz me"*
4. PADAYON gives the saved quiz.

**Talking point:** *"Everything is saved. The student can come back days later and review."*

---

## Backup prompts if the model is slow

If Gemma 4 takes too long, switch the model selector to **Auto** and use these reliable prompts:

- *"Explain photosynthesis like I'm 10"*
- *"Make flashcards for photosynthesis"*
- *"Quiz me on photosynthesis"*
- *"Unsa ang photosynthesis? Dili ko kasabot sa English."*

These have fallback seeded materials, so the demo never breaks.

---

## Cost warning

Gemma 4 on-demand on NVIDIA H200 burns credits while deployed and active. For the hackathon demo:

- Use **Auto** model during setup and practice.
- Scale up `accounts/princejirehmorales-2/deployments/ymlz8joa` 4–5 minutes before the judged run:
  ```powershell
  node scripts/gemma4-scale.js up
  ```
- Switch to **Gemma 4** only for the judged demo run.
- Scale down immediately after the demo:
  ```powershell
  node scripts/gemma4-scale.js down
  ```

---

## URLs to bookmark

- App: https://padayon-theta.vercel.app
- Demo with new student: https://padayon-theta.vercel.app/demo?userId=demo-new-student
- Demo with Cebuano learner: https://padayon-theta.vercel.app/demo?userId=demo-bisaya-learner
- Demo with advanced learner: https://padayon-theta.vercel.app/demo?userId=demo-english-advanced
- Demo with struggling learner: https://padayon-theta.vercel.app/demo?userId=demo-struggling-student
