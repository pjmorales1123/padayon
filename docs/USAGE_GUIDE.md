# PADAYON Usage Guide

This guide is written for judges, demo viewers, and developers who want to understand how to use PADAYON without reading the code first.

## 1. Open The App

Use the hosted demo:

```text
https://padayon-theta.vercel.app
```

For local development:

```powershell
cd C:\Users\Admin\padayon
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## 2. Choose Or Create A Learner

PADAYON supports persistent learner profiles. For a clean demo, create a new profile or select a prepared demo learner.

The learner profile controls:

- preferred language and confidence
- learning style
- strengths and weaknesses
- quiz history
- topic progress
- generated materials saved in the library

New profiles should receive the same learner-summary, quiz, visual-guide, and confidence updates as existing demo profiles.

## 3. Start A Chat

Open the chat page and send messy study input. Example:

```text
photosynthesis chlorophyll sunlight CO2 oxygen glucose food important
```

PADAYON should:

- classify the subject and topic
- align the topic to curriculum context
- produce a student-friendly explanation
- save useful generated materials
- update the learner summary
- show a runtime badge for Gemma or fallback

## 4. Upload Notes

Use the upload button to add an image or PDF.

Supported upload behavior:

- image and PDF notes are accepted
- uploaded notes are summarized cleanly
- OCR text should not leak raw fragmented table contents into the chat
- the upload should be saved as source material
- PADAYON should wait for the student's next instruction before creating unrelated materials

Good follow-up prompts:

```text
Make this into a reviewer.
```

```text
Explain this in Cebuano first, then English.
```

```text
Create a quiz from my uploaded notes.
```

## 5. Ask For Learning Materials

PADAYON can generate:

- clean notes
- reviewers
- flashcards
- quizzes
- summaries
- stories
- visual guides

Example prompts:

```text
Make flashcards for this topic.
```

```text
Give me a short quiz.
```

```text
I am a visual learner. Show me a visual guide.
```

After the response appears, check the Library and Learner Summary to confirm the material and learner memory were updated.

## 6. Take A Quiz

When PADAYON shows a quiz, answer the questions in the chat UI.

Expected behavior:

- quiz score is recorded
- topic progress updates
- confidence and learner-summary signals update
- new learner profiles receive the same update behavior as existing profiles

## 7. Check The Library

Open the Library page after a chat or upload.

You should see saved topics and generated materials organized by learner. This is the proof that PADAYON is not just answering once; it is building a reusable study workspace.

## 8. Check The Learner Summary

Open the profile or learner summary panel.

Expected updates include:

- recent uploaded source material
- generated visual guides
- quiz scores
- topic progress
- strengths and weaknesses
- language confidence
- learning style signals

## 9. Demo Gemma

Before a Gemma demo, scale up the Fireworks deployment:

```powershell
node scripts/gemma4-scale.js up
node scripts/gemma4-scale.js status
```

Wait until the deployment is ready. Then select Gemma in the chat UI and send a prompt.

The runtime badge should show Gemma when the request is served by Gemma. If the deployment is down or unavailable, PADAYON should still answer through fallback and label that fallback clearly.

After the demo, scale down to save credits:

```powershell
node scripts/gemma4-scale.js down
```

## 10. Judge Demo Script

Use this short flow for evaluation:

1. Open the live demo.
2. Create a fresh learner profile.
3. Upload a notes image or type messy notes.
4. Ask PADAYON to explain in Cebuano/Filipino first, then English.
5. Ask for flashcards.
6. Ask for a quiz and answer it.
7. Ask for a visual guide.
8. Open the Library and Learner Summary.
9. Show the backend monitor and model runtime badge.
10. If Gemma is scaled up, switch to Gemma and send one prompt.

## 11. Troubleshooting

If the chat shows fallback, check whether Gemma is scaled up and configured:

```powershell
node scripts/gemma4-scale.js status
```

If uploads look fragmented, retry with a clearer image and verify that the app is using the latest deployed commit.

If learner summary does not update, refresh once and confirm the selected learner profile is the same one used in chat.

If materials appear after the loading bar stops, the app should be updated to the latest commit because the loading state is expected to stay active until the response and requested materials are visible.
