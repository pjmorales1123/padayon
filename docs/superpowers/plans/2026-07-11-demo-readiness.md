# PADAYON Demo Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a reliable, navigable, judge-ready PADAYON demo that visibly proves personalization, agent orchestration, persistence, and truthful fallback/Gemma runtime behavior.

**Architecture:** Extract the existing chat behavior into a reusable client workspace and render it directly in both `/chat` and `/demo`. Add a shared query-preserving navigation layer, a demo-owned request lifecycle, modular learner and agent panels, and runtime metadata reported from the model boundary through the teaching response. Preserve the existing agent pipeline and persistence APIs while making their state visible and recoverable.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript, Tailwind CSS 4, Supabase, Fireworks AI, optional Gemma endpoint, Vitest, Testing Library, and lucide-react.

## Global Constraints

- The Live Demo is the primary presentation surface; Home, Chat, Library, Profile, and topic materials support the story.
- Preserve the current `userId` while moving between demo, chat, library, profile, and topic routes.
- Model badges state the actual runtime; fallback is never presented as Gemma.
- The four persona responses must remain visibly different according to their stored profiles.
- Fallback verification must pass before Gemma verification begins.
- Keep the repository public, documented, runnable from its instructions, and containerized.
- Do not expose credentials in source, logs, screenshots, test fixtures, or commits.
- Follow the local Next.js 16 documentation under `node_modules/next/dist/docs/` for navigation, Client Component, `useSearchParams`, image, and testing behavior.
- Use `next/link` for app navigation and keep `useSearchParams` consumers inside existing Suspense boundaries.
- Use the configured Geist family consistently; remove the Arial body override.
- Keep cards at modest radii, preserve keyboard focus, respect reduced motion, and prevent horizontal scrolling at supported viewports.

---

### Task 1: Add the Unit Test Harness and Icon Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.mts`
- Create: `src/test/setup.ts`
- Test: `src/test/smoke.test.ts`
- Delete: `src/components/chat/AgentActivity.tsx`

**Interfaces:**
- Consumes: the existing `@/*` TypeScript path alias from `tsconfig.json`.
- Produces: `npm test`, which runs all unit and component tests once in jsdom.

- [ ] **Step 1: Install the documented Next.js Vitest stack and lucide icons**

Run:

```powershell
npm install lucide-react
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

Expected: `package.json` and `package-lock.json` include the new runtime and test dependencies without removing existing packages.

- [ ] **Step 2: Add the test script and Vitest configuration**

Add to `package.json` scripts:

```json
"test": "vitest run"
```

Create `vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
```

Create `src/test/setup.ts`:

```ts
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

- [ ] **Step 3: Write and run a harness test**

Create `src/test/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs TypeScript tests", () => {
    expect("PADAYON".toLowerCase()).toBe("padayon");
  });
});
```

Run: `npm test`

Expected: one passing test and exit code 0.

- [ ] **Step 4: Remove the unused component that blocks the baseline lint gate**

Delete `src/components/chat/AgentActivity.tsx`. `rg -n "AgentActivity" src` must return no consumers before deletion, and `npm run lint` must then exit 0. Keep any non-blocking warnings for the focused cleanup in Task 6.

- [ ] **Step 5: Verify and commit the harness**

Run:

```powershell
npm run lint
npm test
git add package.json package-lock.json vitest.config.mts src/test/setup.ts src/test/smoke.test.ts src/components/chat/AgentActivity.tsx
git commit -m "add frontend test harness"
```

Expected: tests pass; lint exits 0 with only non-blocking warnings; commit succeeds.

---

### Task 2: Add Persona-Preserving Shared Navigation

**Files:**
- Create: `src/lib/navigation.ts`
- Create: `src/lib/navigation.test.ts`
- Create: `src/components/navigation/AppNavigation.tsx`
- Create: `src/components/navigation/AppNavigation.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/library/page.tsx`
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/topic/[id]/page.tsx`
- Modify: `src/app/deck/page.tsx`

**Interfaces:**
- Consumes: `userId: string`, `busy?: boolean`, and the current pathname.
- Produces: `buildAppHref(path: string, userId?: string): string` and `<AppNavigation userId busy />`.

- [ ] **Step 1: Write failing query-preservation tests**

Create `src/lib/navigation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAppHref } from "./navigation";

describe("buildAppHref", () => {
  it("preserves the selected learner", () => {
    expect(buildAppHref("/library", "demo-bisaya-learner")).toBe(
      "/library?userId=demo-bisaya-learner",
    );
  });

  it("returns a clean route without a learner", () => {
    expect(buildAppHref("/profile")).toBe("/profile");
  });
});
```

Run: `npm test -- src/lib/navigation.test.ts`

Expected: FAIL because `src/lib/navigation.ts` does not exist.

- [ ] **Step 2: Implement the route contract**

Create `src/lib/navigation.ts`:

```ts
export const APP_DESTINATIONS = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Live Demo" },
  { href: "/chat", label: "Chat" },
  { href: "/library", label: "Library" },
  { href: "/profile", label: "Profile" },
] as const;

export function buildAppHref(path: string, userId?: string): string {
  if (!userId) return path;
  const params = new URLSearchParams({ userId });
  return `${path}?${params.toString()}`;
}
```

Run: `npm test -- src/lib/navigation.test.ts`

Expected: both tests pass.

- [ ] **Step 3: Write a failing navigation component test**

Create `src/components/navigation/AppNavigation.test.tsx` with Next hooks mocked before importing the component:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/library",
}));

import AppNavigation from "./AppNavigation";

describe("AppNavigation", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("marks the current route and carries the learner into links", () => {
    render(<AppNavigation userId="demo-bisaya-learner" />);
    expect(screen.getByRole("link", { name: "Library" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe(
      "/profile?userId=demo-bisaya-learner",
    );
  });
});
```

Run: `npm test -- src/components/navigation/AppNavigation.test.tsx`

Expected: FAIL because `AppNavigation` does not exist.

- [ ] **Step 4: Implement accessible icon navigation**

Create `src/components/navigation/AppNavigation.tsx` as a Client Component. Map the five destinations to `House`, `Presentation`, `MessageCircle`, `Library`, and `UserRound` from `lucide-react`. Each `Link` must use `buildAppHref`, include `aria-label={label}`, set `aria-current="page"` when active, show text at `sm` and above, and call `window.confirm("PADAYON is still working. Leave this page?")` before navigation when `busy` is true.

The public interface must be exactly:

```tsx
interface AppNavigationProps {
  userId?: string;
  busy?: boolean;
  className?: string;
}

export default function AppNavigation({
  userId,
  busy = false,
  className = "",
}: AppNavigationProps) {
  return <nav aria-label="Primary navigation" className={className} />;
}
```

Fill the returned `nav` with the five mapped `Link` elements described above; do not use an overflow menu.

Run: `npm test -- src/components/navigation/AppNavigation.test.tsx`

Expected: component test passes.

- [ ] **Step 5: Mount navigation and preserve persona context**

Update Home to pass `DEMO_USER_ID`. Update Library, Profile, and Topic to derive `userId` from `useSearchParams` and pass it to navigation. Wrap new `useSearchParams` consumers in the page's existing `Suspense` boundary. Replace isolated Home/Library links with the shared navigation. Keep a labeled Back button on Topic that points to `buildAppHref("/library", userId)`.

Change Profile from hardcoded `DEMO_USER_ID` to its query-derived `userId` in both GET and PUT requests:

```ts
const searchParams = useSearchParams();
const userId = searchParams.get("userId") || DEMO_USER_ID;
```

Because Profile has no current Suspense boundary, rename its interactive body to `ProfileInner` and export this wrapper:

```tsx
export default function Profile() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading profile...</div>}>
      <ProfileInner />
    </Suspense>
  );
}
```

Do not place app navigation on the presentation-only `/deck` route; add only a `Home` icon button there so slide keyboard behavior remains intact.

- [ ] **Step 6: Verify and commit navigation**

Run:

```powershell
npm test -- src/lib/navigation.test.ts src/components/navigation/AppNavigation.test.tsx
npm run build
git add src/lib/navigation.ts src/lib/navigation.test.ts src/components/navigation/AppNavigation.tsx src/components/navigation/AppNavigation.test.tsx src/app/page.tsx src/app/library/page.tsx src/app/profile/page.tsx src/app/topic/[id]/page.tsx src/app/deck/page.tsx
git commit -m "add persona aware navigation"
```

Expected: tests and build pass; every primary destination retains `userId`.

---

### Task 3: Report the Actual AI Runtime

**Files:**
- Modify: `src/lib/fireworks.ts`
- Create: `src/lib/fireworks.test.ts`
- Modify: `src/lib/agents.ts`
- Modify: `src/app/api/agent/route.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `ModelRuntime`, `ModelRuntimeReporter`, optional reporter argument on `callFireworks`, optional reporter argument on `teachingAgent`, and `model_runtime` in agent responses.
- Consumes: existing `ModelPreference` and the current fallback sequence.

- [ ] **Step 1: Write failing runtime metadata tests**

Create `src/lib/fireworks.test.ts` with `global.fetch` mocked to return OpenAI-compatible responses. Test three exact cases:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callFireworks, type ModelRuntime } from "./fireworks";

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("callFireworks runtime reporting", () => {
  beforeEach(() => vi.stubEnv("FIREWORKS_API_KEY", "test-key"));

  it("reports the primary serverless model", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("answer")));
    let runtime: ModelRuntime | undefined;
    expect(await callFireworks([{ role: "user", content: "Hi" }], false, 50, "auto", (value) => { runtime = value; })).toBe("answer");
    expect(runtime).toMatchObject({ requested: "auto", provider: "fireworks", fallback: false });
  });

  it("reports serverless fallback after a primary failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("down", { status: 503 })).mockResolvedValueOnce(ok("backup")));
    let runtime: ModelRuntime | undefined;
    expect(await callFireworks([{ role: "user", content: "Hi" }], false, 50, "auto", (value) => { runtime = value; })).toBe("backup");
    expect(runtime).toMatchObject({ provider: "fireworks", fallback: true });
  });

  it("reports fallback when Gemma fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("down", { status: 503 })).mockResolvedValueOnce(ok("backup")));
    let runtime: ModelRuntime | undefined;
    await callFireworks([{ role: "user", content: "Hi" }], false, 50, "gemma-4", (value) => { runtime = value; });
    expect(runtime).toMatchObject({ requested: "gemma-4", provider: "fireworks", fallback: true });
  });
});
```

Run: `npm test -- src/lib/fireworks.test.ts`

Expected: FAIL because runtime types and reporter parameter do not exist.

- [ ] **Step 2: Add runtime reporting without breaking existing callers**

Add to `src/lib/fireworks.ts`:

```ts
export interface ModelRuntime {
  requested: ModelPreference;
  provider: "fireworks" | "gemma";
  model: string;
  fallback: boolean;
}

export type ModelRuntimeReporter = (runtime: ModelRuntime) => void;
```

Add `reportRuntime?: ModelRuntimeReporter` as the fifth argument to `callFireworks`. Call it only after a successful model response. Gemma success reports `{ requested, provider: "gemma", model: modelName, fallback: false }`; default success reports provider `fireworks`; default-after-Gemma and fallback-model success report `fallback: true`. Empty final responses do not report success.

Run: `npm test -- src/lib/fireworks.test.ts`

Expected: all runtime tests pass.

- [ ] **Step 3: Thread teaching runtime through the agent route**

Add `model_runtime` to the shared response type in `src/lib/types.ts`:

```ts
export interface AgentResponseRuntime {
  requested: "auto" | "gemma-3" | "gemma-4";
  provider: "fireworks" | "gemma";
  model: string;
  fallback: boolean;
}
```

Add an optional final `reportRuntime?: ModelRuntimeReporter` argument to `teachingAgent` and pass it to that function's `callFireworks` invocation. In the route, declare `let modelRuntime: ModelRuntime | null = null`, pass `(runtime) => { modelRuntime = runtime; }` to both teaching-agent call sites, include runtime in the `teach` done event, and return `model_runtime: modelRuntime` in every agent response branch.

- [ ] **Step 4: Verify and commit runtime truthfulness**

Run:

```powershell
npm test -- src/lib/fireworks.test.ts
npm run build
git add src/lib/fireworks.ts src/lib/fireworks.test.ts src/lib/agents.ts src/app/api/agent/route.ts src/lib/types.ts
git commit -m "report actual ai runtime"
```

Expected: tests and build pass; API responses distinguish Gemma from fallback.

---

### Task 4: Extract the Shared Chat Workspace and Synchronize Requests

**Files:**
- Create: `src/features/chat/request-id.ts`
- Create: `src/features/chat/request-id.test.ts`
- Create: `src/features/chat/ChatWorkspace.tsx`
- Modify: `src/app/chat/page.tsx`

**Interfaces:**
- Produces: `<ChatWorkspace />` with `onRequestStart` and `onRequestComplete` callbacks.
- Consumes: the current chat behavior, agent API, uploads, query-derived initial state, and `AppNavigation`.

- [ ] **Step 1: Write failing request lifecycle tests**

Create `src/features/chat/request-id.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { consumeRequestId } from "./request-id";

describe("consumeRequestId", () => {
  it("uses a supplied request id once", () => {
    expect(consumeRequestId("demo-123", () => "req-new")).toBe("demo-123");
  });

  it("generates an id when none is supplied", () => {
    expect(consumeRequestId(undefined, () => "req-new")).toBe("req-new");
  });
});
```

Run: `npm test -- src/features/chat/request-id.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the request helper**

Create `src/features/chat/request-id.ts`:

```ts
export function consumeRequestId(
  supplied: string | undefined,
  create: () => string,
): string {
  const trimmed = supplied?.trim();
  return trimmed || create();
}
```

Run: `npm test -- src/features/chat/request-id.test.ts`

Expected: both tests pass.

- [ ] **Step 3: Extract chat into a reusable component**

Move `ChatInner` and its local message interface, suggestions, upload helpers, camera handling, and send lifecycle from `src/app/chat/page.tsx` into `src/features/chat/ChatWorkspace.tsx`. Keep behavior unchanged except for the prop contract below and the request lifecycle changes in Step 4.

Use this exact public interface:

```tsx
export interface ChatWorkspaceProps {
  userId: string;
  initialModel?: "auto" | "gemma-4";
  initialPrompt?: string;
  autoSend?: boolean;
  initialRequestId?: string;
  embedded?: boolean;
  onRequestStart?: (requestId: string) => void;
  onRequestComplete?: (requestId: string) => void;
}

export default function ChatWorkspace({
  userId,
  initialModel = "auto",
  initialPrompt = "",
  autoSend = false,
  initialRequestId,
  embedded = false,
  onRequestStart,
  onRequestComplete,
}: ChatWorkspaceProps) {
  return <section aria-label="PADAYON chat workspace" />;
}
```

Fill the returned section with the existing chat UI. When `embedded` is false, render `AppNavigation`; when true, omit standalone navigation and the Home button.

- [ ] **Step 4: Make request identity observable and stable**

Store `initialRequestId` in a ref. At the beginning of `send`, consume that ref once, then generate later IDs:

```ts
const initialRequestIdRef = useRef(initialRequestId);
const reqId = consumeRequestId(initialRequestIdRef.current, () => generateId("req"));
initialRequestIdRef.current = undefined;
onRequestStart?.(reqId);
```

Call `onRequestComplete?.(reqId)` in the request's `finally` block. Wrap `send` in `useCallback` with its real dependencies so the auto-send effect is stable. Remove unused `activeRequestId` state. Preserve the failed prompt in `input` when the request throws.

- [ ] **Step 5: Reduce the route to a query adapter**

Keep `src/app/chat/page.tsx` as a small Suspense-wrapped Client Component that reads `userId`, `model`, `prompt`, `autoSend`, and `requestId`, then renders `ChatWorkspace` with those values. Do not duplicate chat logic in the route.

- [ ] **Step 6: Verify the extracted workspace**

Run:

```powershell
npm test -- src/features/chat/request-id.test.ts
npm run lint
npm run build
git add src/features/chat/request-id.ts src/features/chat/request-id.test.ts src/features/chat/ChatWorkspace.tsx src/app/chat/page.tsx
git commit -m "extract shared chat workspace"
```

Expected: lint no longer reports `set-state-in-effect`, build passes, and the chat route retains its current features.

---

### Task 5: Replace the Demo Iframe with the Judge Workspace

**Files:**
- Create: `src/features/demo/demo-personas.ts`
- Create: `src/features/demo/AgentTrail.tsx`
- Create: `src/features/demo/AgentTrail.test.tsx`
- Create: `src/features/demo/LearnerSummary.tsx`
- Create: `src/features/demo/DemoWorkspace.tsx`
- Modify: `src/app/demo/page.tsx`

**Interfaces:**
- Consumes: `ChatWorkspace`, agent-run polling API, profile API, library API, persona seed API, and shared navigation.
- Produces: a direct three-region demo and a single active request ID shared by chat and agent trail.

- [ ] **Step 1: Extract the four demo personas**

Create `src/features/demo/demo-personas.ts`:

```ts
export interface DemoPersona {
  id: string;
  name: string;
  label: string;
  summary: string;
  prompt: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { id: "demo-new-student", name: "Maria", label: "Brand new", summary: "Starts with simple English and no learning history.", prompt: "Explain photosynthesis" },
  { id: "demo-bisaya-learner", name: "Juan", label: "Cebuano-first", summary: "Learns in Cebuano first, then bridges to academic English.", prompt: "Explain photosynthesis like I'm 10" },
  { id: "demo-english-advanced", name: "Alex", label: "Advanced", summary: "Receives deeper analysis and harder examples.", prompt: "Explain situational irony with a harder example" },
  { id: "demo-struggling-student", name: "Bea", label: "Needs support", summary: "Receives encouragement and smaller steps.", prompt: "I don't get quadratic equations. It looks hard." },
];
```

- [ ] **Step 2: Write a failing agent-trail test**

Mock `fetch` to return a run containing `start`, `classify`, and `finish` events. Render `<AgentTrail requestId="req-1" />`; assert that `Classifier Agent`, `Response complete`, and `100%` appear. Render with `requestId={null}` and assert the prompt to send a message appears.

Run: `npm test -- src/features/demo/AgentTrail.test.tsx`

Expected: FAIL because `AgentTrail` does not exist.

- [ ] **Step 3: Implement the modular agent trail**

Move the existing monitor event types, step ordering, labels, and polling from `src/app/demo/page.tsx` into `AgentTrail.tsx`. Accept exactly:

```tsx
interface AgentTrailProps {
  requestId: string | null;
}
```

Poll only when `requestId` is non-null. Retain prior events on a transient poll failure, show a scoped retry button after three consecutive failures, display the latest meaningful event details, and calculate 100% only when a done `finish` event exists.

Run: `npm test -- src/features/demo/AgentTrail.test.tsx`

Expected: agent-trail tests pass.

- [ ] **Step 4: Implement learner summary states**

Create `LearnerSummary.tsx` with props `{ userId: string; refreshKey: number }`. Fetch `/api/profile` and `/api/library` together. Render skeleton labels while loading, the learner name/language/learning style/topic counts when successful, a clear no-history action for Maria, and a Retry button using the same loader when either response fails.

- [ ] **Step 5: Compose the direct demo workspace**

Create `DemoWorkspace.tsx` as a Client Component that owns:

```ts
const [userId, setUserId] = useState(initialUserId);
const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
const [refreshKey, setRefreshKey] = useState(0);
const [resetState, setResetState] = useState<"idle" | "working" | "success" | "error">("idle");
```

Render `LearnerSummary`, `ChatWorkspace embedded onRequestStart={setActiveRequestId}`, and `AgentTrail requestId={activeRequestId}` directly; do not render an iframe. Persona selection updates the URL with `router.replace(buildAppHref("/demo", selectedId), { scroll: false })`, clears stale request state, and increments `refreshKey`. Judge prompts call the embedded chat through a controlled `initialPrompt` plus incrementing prompt key, not links with `target="_blank"`.

Reset must POST `{ reset: true }`, reject non-2xx responses using the server-provided `error`, then increment `refreshKey`, clear request state, and show `Demo personas reset.` for at least three seconds.

- [ ] **Step 6: Reduce the demo route and verify**

Keep `src/app/demo/page.tsx` as a Suspense-wrapped query adapter that reads `userId` and renders `DemoWorkspace initialUserId={userId}`.

Run:

```powershell
npm test -- src/features/demo/AgentTrail.test.tsx
npm run lint
npm run build
git add src/features/demo src/app/demo/page.tsx
git commit -m "build direct live demo workspace"
```

Expected: no iframe remains, prompt sends update the visible trail, and build passes.

---

### Task 6: Add Recovery States and Finish the Visual Pass

**Files:**
- Modify: `src/features/chat/ChatWorkspace.tsx`
- Modify: `src/features/demo/DemoWorkspace.tsx`
- Modify: `src/features/demo/AgentTrail.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/library/page.tsx`
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/topic/[id]/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/lib/agents.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing API errors and `model_runtime` from Task 3.
- Produces: explicit loading, slow, success, fallback, empty, and retry states across judged paths.

- [ ] **Step 1: Add exact chat recovery behavior**

In `ChatWorkspace`, add `requestState: "idle" | "working" | "slow" | "error"`, `lastFailedPrompt`, and `lastRuntime`. Start an eight-second timer when sending; change `working` to `slow` when it fires. Clear the timer in `finally`. On failure, restore the prompt, show the server message plus Retry, and keep prior messages. On success, store `model_runtime` and show one of:

- `Gemma 4` when provider is `gemma` and fallback is false;
- `Auto · primary` when provider is `fireworks` and fallback is false;
- `Fallback · Fireworks` when fallback is true.

Use the copy `Still working through your study pack. You can watch each step in the learning trail.` for slow requests.

- [ ] **Step 2: Validate uploads before transmission**

Reject more than 10 files, any file over 12 MB, and file types outside images or PDF. Keep the existing six-page PDF cap. Surface exact messages in chat and reset the file input so the same corrected file can be selected again.

- [ ] **Step 3: Surface boundary failures on supporting pages**

Home persona reset must inspect `res.ok`, show `Reset complete` or the returned error, and reload data. Library and Profile must add loading/error state plus Retry; create/rename/delete/save operations must display returned errors. Topic must show loading, not-found, fetch-error, and quiz-save-error states without discarding answers.

- [ ] **Step 4: Apply the approved visual tokens and responsive constraints**

In `globals.css`, define the six approved colors, set `body` to `var(--font-geist-sans), Arial, sans-serif`, add `scroll-padding-top`, visible `:focus-visible`, and a reduced-motion block that disables nonessential animation. Use `minmax(0, 1fr)` grid tracks and `min-w-0` in demo regions. Desktop uses learner/chat/agent columns; tablet uses summary plus two columns; mobile uses a segmented Chat/Profile/Agents view. No component may force viewport-width horizontal scrolling.

- [ ] **Step 5: Clear lint warnings and dead code**

Replace dynamic preview `<img>` tags with `next/image` using explicit width/height and `unoptimized` for data URLs. Remove the unused `i` argument in `src/lib/agents.ts`. Confirm no commented-out replacement code or orphaned files remain.

- [ ] **Step 6: Update setup and demo documentation**

Document `.env.example`, persona-preserving navigation, the fallback-first demo rehearsal, the actual-runtime badge, and the Gemma gate in README. Keep the existing container instructions.

- [ ] **Step 7: Verify and commit recovery/UI work**

Run:

```powershell
npm test
npm run lint
npm run build
git diff --check
git add src/features/chat/ChatWorkspace.tsx src/features/demo/DemoWorkspace.tsx src/features/demo/AgentTrail.tsx src/app/page.tsx src/app/library/page.tsx src/app/profile/page.tsx src/app/topic/[id]/page.tsx src/app/globals.css src/lib/agents.ts README.md
git commit -m "polish demo states and responsive ui"
```

Expected: tests, lint, and build pass with zero errors; the diff has no whitespace errors.

---

### Task 7: Run and Record the Fallback-First Verification Gate

**Files:**
- Modify: `scripts/smoke-test.js`
- Modify: `scripts/persona-test.js`
- Create: `docs/demo-readiness-report.md`

**Interfaces:**
- Consumes: production server with `model=auto`, seeded Supabase data, and existing API test scripts.
- Produces: reproducible evidence that the fallback path and judged behavior pass before Gemma testing.

- [ ] **Step 1: Extend smoke assertions**

For the agent response in `scripts/smoke-test.js`, assert the returned `requestId` equals the supplied ID, `model_runtime.provider === "fireworks"`, and the run endpoint reaches a done `finish` event for that same ID. In `persona-test.js`, set `model: "auto"` and exit nonzero when any persona check fails instead of only printing failures.

- [ ] **Step 2: Run automated fallback checks**

Run:

```powershell
npm test
npm run lint
npm run build
$env:HOSTNAME='0.0.0.0'
$env:PORT='3000'
$server = Start-Process -FilePath 'node.exe' -ArgumentList @('.next/standalone/server.js') -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
for($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    Invoke-RestMethod 'http://localhost:3000/api/health' | Out-Null
    break
  } catch {
    Start-Sleep -Milliseconds 500
  }
}
$env:SMOKE_TEST_URL='http://localhost:3000'
try {
  npm run smoke-test
  if($LASTEXITCODE -ne 0) { throw 'smoke-test failed' }
  npm run persona-test
  if($LASTEXITCODE -ne 0) { throw 'persona-test failed' }
} finally {
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
}
```

Expected: every command exits 0; all four persona checks pass; runtime metadata reports Fireworks.

- [ ] **Step 3: Verify the production UI in a browser**

Start the built standalone server using the command required by `output: "standalone"`:

```powershell
$env:HOSTNAME='0.0.0.0'
$env:PORT='3000'
node .next/standalone/server.js
```

Use the in-app browser to verify Home, Live Demo, Chat, Library, Profile, and one topic at desktop 1440x900, tablet 1024x768, and mobile 390x844. Exercise navigation, one Juan prompt, one Bea prompt, persona reset, one invalid upload, one successful image/PDF import, flashcard retrieval, quiz persistence, and profile persistence. Confirm no horizontal scroll, overlap, blank region, console error, or mislabeled runtime.

- [ ] **Step 4: Verify the container path**

Run:

```powershell
docker build -t padayon-demo-ready .
docker run --rm -d --name padayon-demo-ready -p 3100:3000 --env-file .env.local padayon-demo-ready
Invoke-RestMethod http://localhost:3100/api/health
docker stop padayon-demo-ready
```

Expected: image builds, health returns HTTP 200, and the container stops cleanly. If Docker is unavailable, record the exact unavailable command and rely on the standalone production startup as partial evidence without claiming container verification.

- [ ] **Step 5: Record fallback evidence and commit**

Create `docs/demo-readiness-report.md` with dated command results, persona outcomes, browser viewport checks, import result, persistence checks, runtime metadata, container result, and any residual risk. Do not include keys, tokens, full request payloads, or student-sensitive content.

Run:

```powershell
git add scripts/smoke-test.js scripts/persona-test.js docs/demo-readiness-report.md
git commit -m "verify fallback demo flow"
```

Expected: report explicitly marks Gate 1 PASS before Task 8 starts.

---

### Task 8: Verify Gemma and Finalize the Demo Script

**Files:**
- Modify: `docs/demo-readiness-report.md`
- Modify: `DEMO_SCRIPT.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: a Gate 1 PASS report and a configured Gemma endpoint or deployment.
- Produces: evidence for Gemma success and fallback, plus a repeatable judged script with Auto backup.

- [ ] **Step 1: Enforce the Gemma gate**

Read `docs/demo-readiness-report.md`. Do not continue unless every Gate 1 item is marked PASS. Call `/api/health` and require `gemma4Configured: true`. If false, record `Gemma verification unavailable: no configured endpoint or deployment` and stop without labeling Gemma as tested.

- [ ] **Step 2: Run the judged Gemma prompt**

Select Juan, choose Gemma 4, and send `Explain photosynthesis like I'm 10`. Verify the response is personalized, the learning trail finishes, and `model_runtime` reports `{ provider: "gemma", fallback: false }`. Record latency and the exact model identifier without recording credentials.

- [ ] **Step 3: Verify truthful Gemma fallback**

Use a controlled unavailable Gemma target only in the local test environment, send one short prompt, and verify the response succeeds through Fireworks with `{ requested: "gemma-4", provider: "fireworks", fallback: true }` and the UI badge reads `Fallback · Fireworks`. Restore the real endpoint immediately after this test.

- [ ] **Step 4: Rehearse judged and backup paths**

Run the complete judged flow once with Gemma and once with Auto: persona selection, prompt, live learning trail, generated/retrieved material, Library navigation, quiz, and Profile. Confirm all navigation retains the selected persona.

- [ ] **Step 5: Update documentation and run final verification**

Update `DEMO_SCRIPT.md` with visible navigation steps, the actual-runtime badge, the fallback switch point, and the final backup prompts. Update README with the verified Gemma configuration and exact startup command.

Run:

```powershell
npm test
npm run lint
npm run build
npm run smoke-test
git diff --check
git status --short
```

Expected: all commands exit 0; only intended documentation/report changes remain.

- [ ] **Step 6: Commit the verified demo handoff**

Run:

```powershell
git add docs/demo-readiness-report.md DEMO_SCRIPT.md README.md
git commit -m "document verified gemma demo"
```

Expected: commit succeeds and the working tree is clean.

---

## Completion Audit

Before declaring the work complete, check each acceptance criterion from `docs/superpowers/specs/2026-07-11-demo-readiness-design.md` against current evidence in tests, browser results, command output, and `docs/demo-readiness-report.md`. Re-run the full verification command set after the final commit. Do not treat a passing build as proof of browser behavior, persistence, container startup, fallback truthfulness, or Gemma execution.
