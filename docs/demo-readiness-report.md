# PADAYON Demo Readiness Report

**Date:** 2026-07-11
**Branch:** `demo-readiness`
**Commit range verified:** `e307c46..3dd72fe` (plus `next.config.ts` standalone root fix)
**Environment:** Windows 11, Node.js 24.14.0, Next.js 16.2.10

## Goal
Confirm the fallback-first demo flow is reliable, truthful, and judge-ready before any Gemma testing.

## Commands Run

```powershell
npm test
npm run lint
npm run build
set -a && source .env.local && set +a && HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js
SMOKE_TEST_URL=http://localhost:3000 npm run smoke-test
SMOKE_TEST_URL=http://localhost:3000 npm run persona-test
```

## Results

### Unit / component tests
- **Command:** `npm test`
- **Result:** 6 test files, **11 tests passed**

### Lint
- **Command:** `npm run lint`
- **Result:** exit code 0, **0 errors, 0 warnings**

### Production build
- **Command:** `npm run build`
- **Result:** exit code 0, all 20 static/dynamic routes generated
- **Standalone output:** `.next/standalone/server.js` generated after setting `outputFileTracingRoot` and `turbopack.root` to `__dirname` in `next.config.ts`.

### Smoke tests (`scripts/smoke-test.js`)
Run against the built standalone server (`model: "auto"`):

| Test | Result |
|---|---|
| Health check returns ready | ✅ |
| Seed demo user and curriculum | ✅ |
| GET profile returns user | ✅ |
| Agent returns useful response for photosynthesis | ✅ |
| Returned `requestId` equals supplied ID | ✅ |
| `model_runtime.provider === "fireworks"` | ✅ |
| Agent run endpoint reaches done `finish` event | ✅ |
| Library returns organized folders | ✅ |
| Agent retrieves flashcards | ✅ |
| Topic endpoint returns materials and story | ✅ |
| Quiz submission updates progress | ✅ |
| PUT profile updates language confidence | ✅ |
| Folder CRUD endpoints work | ✅ |

**Passed: 11 / 11**

### Persona tests (`scripts/persona-test.js`)
Run against the built standalone server (`model: "auto"`):

| Persona | Result |
|---|---|
| Advanced student (Alex) | ✅ |
| Cebuano-first learner (Marie) | ✅ |
| Struggling-with-motivation student (Juan) | ✅ |
| Student who got the wrong answer (Sam) | ✅ |

**Passed: 4 / 4**

### Route health checks
All primary routes returned HTTP 200:

- `/`
- `/demo?userId=demo-bisaya-learner`
- `/chat?userId=demo-bisaya-learner`
- `/library?userId=demo-bisaya-learner`
- `/profile?userId=demo-bisaya-learner`
- `/topic/<id>?userId=demo-bisaya-learner`

## Container verification
- **Command:** `docker --version`
- **Result:** Docker is not installed on this machine.
- **Mitigation:** Verified the standalone server path instead (`node .next/standalone/server.js`). The Dockerfile is present and uses the same entry point.

## Browser / UI verification
- The Kimi WebBridge daemon was started (`running: true`), but the browser extension was not connected (`extension_connected: false`).
- Without the extension, full visual/interaction verification could not be automated in this session.
- Manual route health checks confirm the server renders every page without a 5xx error.
- Recommended follow-up: open the browser with the Kimi WebBridge extension and run the `/demo` flow through Juan and Bea prompts, persona reset, invalid upload, image/PDF import, flashcard retrieval, quiz persistence, and profile persistence.

## Gate 1 Verdict

**PASS.**

The fallback (`model: "auto"`) path builds cleanly, starts from the standalone artifact, passes all API and persona checks, reports `provider: "fireworks"`, returns the supplied `requestId`, reaches a done `finish` event, and serves every page route successfully.

Gemma verification (Task 8) may now proceed.

## Residual risks

1. **Browser UI verification** was not completed because the Kimi WebBridge browser extension was not connected. This is the highest-priority follow-up before the live demo.
2. **Container verification** could not run because Docker is unavailable locally. The standalone path covers the same build output, but an actual `docker build / run` on a machine with Docker is still recommended.
3. **Gemma endpoint** is not configured in `.env.local` (`gemma4Configured: false` on `/api/health`). Task 8 will require adding the AMD-hosted Gemma URL/key before testing.

## Notes

- No credentials, API keys, or full request payloads are included in this report.
- All tested requests used the Fireworks serverless fallback path; no paid Gemma inference was consumed during this gate.

## Gate 2 — Gemma verification

### Gemma endpoint configuration

- Added to `.env.local`:
  ```
  GEMMA_4_DEPLOYMENT=accounts/princejirehmorales-2/deployments/ymlz8joa
  ```
- `/api/health` then returned `gemma4Configured: true`.

### Scaling and warmup

```powershell
node scripts/gemma4-scale.js up
```

The deployment reached `READY` with one replica after ~75 seconds, then needed an additional ~3.5 minutes before inference requests succeeded (`DEPLOYMENT_SCALING_UP` → success).

### Gemma success test

Prompt sent with `model: "gemma-4"`:

```powershell
curl -s -X POST http://localhost:3000/api/agent -H 'Content-Type: application/json' -d '{"userId":"demo-bisaya-learner","model":"gemma-4","requestId":"gemma-real-test-4","message":"Explain photosynthesis like I am 10"}'
```

**Result:**

- Response delivered in Cebuano-first style for Juan.
- `model_runtime` reported:
  ```json
  { "requested": "gemma-4", "provider": "gemma", "model": "accounts/princejirehmorales-2/deployments/ymlz8joa", "fallback": false }
  ```
- The UI badge would read **Gemma 4**.

### Gemma fallback truthfulness test

Before the deployment was fully warm, the same prompt with `model: "gemma-4"` returned:

```json
{ "requested": "gemma-4", "provider": "fireworks", "model": "accounts/fireworks/models/deepseek-v4-flash", "fallback": true }
```

The response still succeeded and the badge would read **Fallback · Fireworks**.

### Scale-down

```powershell
node scripts/gemma4-scale.js down
```

Deployment desired replica count set to 0 to stop billing.

### Gemma gate verdict

**PASS.**

Gemma 4 served a real request through the Fireworks on-demand deployment, the runtime badge truthfully reported `provider: "gemma"`, and the fallback path was verified when the deployment was still cold. The deployment was scaled down after testing.

### Demo-day Gemma note

- Scale up the deployment 4–5 minutes before the judged Gemma moment.
- Use **Auto** for setup and practice to save credits.
- Switch to **Gemma 4** only for the judged demo run, then scale down again.
