# PADAYON Demo Readiness Design

## Purpose

Prepare PADAYON for a reliable, persuasive judged demo without replacing the product's existing learning features. The Live Demo is the primary presentation surface; Home, Chat, Library, Profile, and topic materials support the story and must remain easy to reach.

## Hackathon Alignment

PADAYON competes in the AMD Developer Hackathon: ACT II Unicorn Track. The official criteria are creativity and originality, product/market potential, completeness, and meaningful use of AMD platforms. The implementation will make each criterion visible:

- **Creativity and originality:** show the multi-agent learning trail and learner-specific adaptation, not a generic chat transcript.
- **Product/market potential:** keep the Filipino learner problem, translanguaging, curriculum alignment, and persistent study library central to the experience.
- **Completeness:** make the judged flow navigable, responsive, recoverable, and tested across expected failure states.
- **AMD platform use:** display the actual selected runtime and fallback outcome accurately, with Gemma tested only after the Fireworks fallback path passes.
- **Gemma partner award:** demonstrate Gemma only when its configured endpoint is genuinely available; never label a fallback response as Gemma.

The repository must remain public, documented, runnable from its instructions, and containerized.

## Experience Architecture

### Shared Navigation

Add a compact shared application navigation used by Home, Live Demo, Chat, Library, Profile, and topic views.

- Primary destinations: Home, Live Demo, Chat, Library, and Profile.
- Desktop: icon plus text labels in a restrained header.
- Mobile: compact icon controls with accessible labels and a clear active state.
- Topic and material views include a Back control in addition to global navigation.
- Preserve the current `userId` while moving between demo, chat, library, profile, and topic routes so the selected persona remains coherent.
- Navigation remains usable during AI work, but destructive context changes prompt for confirmation when a request or upload is still active.

### Live Demo Workspace

Replace the iframe-based demo composition with a shared chat workspace rendered directly inside the demo.

- Desktop: learner context, conversation, and live agent trail appear as three coordinated regions.
- Tablet: learner context becomes a compact summary above a two-column chat and agent layout.
- Mobile: chat is primary, with learner context and agent activity available as tabs or drawers without horizontal scrolling.
- Persona switching, reset, model selection, navigation, and demo status stay in a stable top bar.
- Judge prompts run inside the current workspace rather than opening a new tab.
- Reset shows progress, success, and actionable failure feedback.

### Learning Trail

The agent panel is the signature presentation element. It shows meaningful outcomes from the pipeline:

- detected subject, subcategory, topic, and intent;
- curriculum competency match;
- learner profile and relevant memory loaded;
- saved material retrieval or new materials created;
- teaching response model and fallback status;
- saved conversation and memory update;
- completion, recoverable error, or retry state.

The trail uses a single request identity shared with the chat request. Progress cannot remain at zero while a different request completes.

## Visual Direction

Use a quiet, work-focused educational interface with one expressive element: the live learning trail.

- Ink `#132238`: primary text and agent-panel depth.
- Paper `#F7F9FC`: application background.
- Bayan blue `#2563EB`: primary action and active navigation.
- Growth green `#159A68`: success, saved work, and mastery.
- Sunlight yellow `#F2B84B`: attention and slow-response notices.
- Coral `#DF6B57`: recoverable errors and destructive reset confirmation.

Use the configured Geist family consistently instead of overriding it with Arial. Keep cards at modest radii, maintain visible keyboard focus, respect reduced motion, and avoid decorative effects that do not communicate system state.

## Components and Responsibilities

- **App navigation:** owns destinations, active state, persona query preservation, responsive behavior, and accessible labels.
- **Chat workspace:** owns message composition, uploads, model choice, request lifecycle, and rendered responses; it can run standalone or inside the demo.
- **Demo workspace:** owns selected persona, active request identity, demo reset, learner summary, and layout composition.
- **Agent trail:** polls only the active request, converts raw events into judge-readable outcomes, and exposes retry/error states.
- **Learner summary:** loads profile and progress with explicit loading, empty, and failure states.
- **Runtime status:** reports configured model availability and the actual model used for each response.

Existing API contracts and study-material behavior remain intact unless a small response metadata addition is required to report the actual runtime accurately.

## Data Flow

1. The selected persona is read from `userId` and propagated through navigation.
2. Demo workspace loads the learner profile, recent topics, and runtime health.
3. Sending a prompt creates one request ID and supplies it to both the agent API and agent trail.
4. Agent events update the trail while the chat displays a concise, current activity label.
5. The response returns teaching content, created or retrieved materials, and actual runtime metadata.
6. The interface confirms what was saved and offers direct Library, Quiz, Flashcards, or Profile navigation when relevant.
7. Reset reseeds personas, reloads the selected learner, clears stale request state, and confirms completion.

## Behavior in Difficult Situations

- Prevent duplicate sends while retaining the student's draft.
- After a slow-response threshold, explain that work is continuing and keep the pipeline visible.
- If Gemma is unavailable, fall back to the serverless Fireworks model and label the result as fallback.
- If both model attempts fail, preserve the prompt and provide Retry plus model-switch guidance.
- If profile or library data fails, keep chat usable and show a scoped retry state.
- Reject unsupported or oversized uploads before transmission with specific guidance.
- Keep partial upload progress understandable for multi-image and multi-page PDF imports.
- Empty library/profile states point to the next meaningful action.
- Agent polling failures do not silently erase prior events.
- Persona reset and API boundary failures surface server-provided errors without exposing credentials.

## Testing Order

### Gate 1: Fallback Runtime

Run all automated and browser checks with Auto/serverless fallback first:

- lint, TypeScript production build, and existing smoke suite;
- persona reset and all four judged personas;
- request ID synchronization and complete learning trail;
- navigation with preserved persona context;
- duplicate send, slow response, API failure, retry, and empty-state behavior;
- upload validation and one successful import path;
- persisted Library, Quiz, Flashcards, and Profile updates;
- desktop, tablet, and mobile browser layouts with no incoherent overlap or horizontal scrolling;
- container build or documented equivalent startup verification.

### Gate 2: Gemma Runtime

Only after Gate 1 passes:

- confirm the Gemma endpoint is configured and reports ready;
- send a judged persona prompt with Gemma selected;
- verify the response and learning trail report Gemma as the actual runtime;
- verify an intentional or naturally unavailable Gemma path falls back cleanly and is labeled accurately;
- rehearse the complete judged flow once with Gemma and once with Auto as the backup route.

## Acceptance Criteria

- A judge can move between every primary view using visible navigation and retain the selected persona.
- The Live Demo never uses an iframe and has no horizontal scrollbar at supported viewports.
- Every chat request and learning trail use the same request ID.
- Judge prompts remain in the demo and visibly advance the agent trail.
- Model badges state the actual runtime; fallback is never presented as Gemma.
- Reset, loading, slow, empty, success, and failure states give clear next actions.
- The four persona responses visibly differ according to their stored profiles.
- Generated materials persist and are reachable from the response and navigation.
- Lint and production build pass with no errors.
- Fallback verification passes before Gemma verification begins.
- The documented demo can be repeated without manual database repair.
