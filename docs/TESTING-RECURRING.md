# Running the tests

Run commands from the repository root in PowerShell using Node.js 24 LTS.
Install dependencies using the repository's pnpm lockfiles:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm --dir client install --frozen-lockfile
corepack pnpm --dir server install --frozen-lockfile
corepack pnpm exec playwright install chromium
```

The npm scripts work regardless of the package manager used to install dependencies:

| Command | Purpose |
| --- | --- |
| `npm test` | Node unit/regression tests, support helpers, then frontend tests |
| `npm run test:unit` | All Node unit/regression tests |
| `npm run test:support` | Isolation guards and fixture helpers; no MongoDB process required |
| `npm run test:client` | Vue component and frontend integration tests |
| `npm run test:integration` | All real API/database integration tests (alias for `test:api`) |
| `npm run test:e2e` | Browser workflows on desktop and mobile Chromium |
| `npm run test:e2e:headed` | Browser tests with visible windows |
| `npm run test:all` | All suites in sequence |
| `npm run build` | Production compilation check |

Run only recurring-task tests:

```powershell
node --test tests/unit/recurrence.test.mjs tests/unit/recurring-tasks.test.mjs
npm run test --prefix client -- src/features/tasks/__tests__/recurringTasks.spec.js
node --test tests/integration/recurring-api.test.mjs
npm run test:e2e -- tests/e2e/recurring-workflows.spec.mjs
npm run test:e2e -- tests/e2e/recurring-workflows.spec.mjs --project=desktop-chromium
corepack pnpm exec playwright show-report
```

## Coverage

- **Unit:** calendar boundaries, end limits, stable occurrence indexes, whole-series claims, competing claims, one-day handovers, next-four/one-date scopes, rolling generation, scoped edits, stale versions, pause/resume and departed helpers. Service unit tests use an in-memory transaction double.
- **Frontend integration:** recurrence controls, default series selection, claim cancellation/family switching, scoped editing, errors and independent exceptions.
- **API integration:** real MongoDB transactions, competing claim requests, permissions/family isolation, persisted sessions, one-day replacements, limited claims, stale edits, pause/resume and generation/deletion behavior.
- **E2E:** creating a repeating task through the form, claiming a series, releasing/replacing one date, cancelling a claim and choosing next four. Each scenario runs on desktop and mobile Chromium.
- **Support:** `tests/support/api-harness.mjs` starts/resets/stops the real API and authenticates fixture accounts; `recurring-fixtures.mjs` provides future-dated task payloads. `database.test.mjs` tests isolation guards and fixture dates. Support is test infrastructure, not a separate product feature.

Existing suites also cover accounts, family settings, recipients, assistant confirmations, contributions, calendars, transit and care logs. These additions focus on the new recurrence behavior.

## Database and browser setup

API/E2E tests use a **single-member local MongoDB replica set** so recurring transactions are real. They never use your Atlas database, load `server/.env`, or run the normal seed script. Fixture resets check that the connected database is an isolated loopback `carecircle_test_*` database.

You do not need to start the normal app servers. Playwright starts its own frontend on port **5180**, with the API and database on available local ports. Leave 5180 free. Reports are saved in `playwright-report/`; failure screenshots/traces are in `test-results/`.

The first API/E2E run downloads MongoDB automatically. Allow internet access and extra time. If startup times out during downloading, rerun after the download completes; a partial archive is not a usable database binary. With an existing compatible MongoDB installation, you can bypass downloading:

```powershell
$env:MONGOMS_SYSTEM_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
npm run test:integration
npm run test:e2e
```

Replace that example with the actual installed path/version. A browser `Executable doesn't exist` error means Chromium needs installing. If `playwright` is not recognized, install root dev dependencies first. These tests do not verify live Gemini, Telegram, Groq or Google Calendar delivery.

## Verification on 28 October 2026

After resolving application merge markers, **133 Node regressions, 2 support tests and 115 frontend tests passed**, and the production build succeeded. The new API/E2E cases remain **unverified** locally: the MongoDB binary was incomplete and the root Playwright package was missing. API startup was attempted with downloads disabled and failed before assertions. Older counts in other testing documents describe earlier runs.
