<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent architecture

- Agent logic lives in `src/lib/agents.ts`.
- The main orchestrator is `src/app/api/agent/route.ts`.
- `studentReplyReview` in `src/lib/agents.ts` is the demo "thinking mode" reviewer: it polishes student-facing replies for clarity, level, language, and helpfulness before they are saved/returned.
- The chat client sends `topicId` with every request so follow-ups (visuals, flashcards, summaries) stay in the current conversation context instead of falling back to the global "last active topic".
- See `CONTEXT.md` for full project state, architecture, and recent decisions.
