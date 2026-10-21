# CareCircle testing

The Week 10 lectures distinguish function/unit tests, isolated component tests,
integration between real components, and complete browser workflows. The tests
here apply that structure to SangYoon's Family Home, Settings and recipient flows.
The earlier 34 Node regression tests remain available unchanged.

Verified on 21 October 2026: `npm run test:all` passed all **72 cases**
(34 existing regressions, 18 Vitest, 8 real MongoDB API integration, and
12 Playwright cases across the desktop/mobile projects). `npm run build` also
passed. These results cover the isolated local environment described below.

## Install and run

Use Node 24 LTS (the verified environment uses 24.13.0) and pnpm. From the root:

```sh
pnpm install --frozen-lockfile
pnpm --dir client install --frozen-lockfile
pnpm --dir server install --frozen-lockfile
pnpm exec playwright install chromium
npm run test:all
```

| Command | What it runs |
| --- | --- |
| `npm test` | Existing Node regression tests, then Vitest unit/component/integration tests |
| `npm run test:client` | Vitest and Vue Test Utils with jsdom |
| `pnpm --dir client test:watch` | Vitest watch mode while editing |
| `npm run test:api` | Real Express routes, JWT authentication, Mongoose and isolated MongoDB |
| `npm run test:e2e` | Playwright on desktop and mobile Chromium, using the real app/API/DB |
| `npm run test:e2e:headed` | The same browser tests with visible browser windows |
| `npm run test:all` | All layers, in sequence |
| `pnpm exec playwright show-report` | The most recent local HTML browser report |

The first DB test downloads a MongoDB binary to its normal machine cache. The
first browser installation downloads Chromium. Later runs reuse these binaries.
E2E tests reserve port 5180 for a test-only Vite server; the API and MongoDB use
free loopback ports. An existing server on 5180 is not reused or stopped.

## What each layer verifies

| Layer | Location | Behavior checked |
| --- | --- | --- |
| Function/unit | `client/src/features/family/__tests__/singapore-dates.spec.js` | Singapore midnight/year boundaries and infant birthday calculations |
| Component | `client/src/features/settings/__tests__/FamilyMembersCard.spec.js` | Admin actions, emitted role change, outside click/Escape dismissal, last-admin UI protection, non-admin restrictions, load errors |
| Component integration | `client/src/features/family/__tests__/MobileTodayTasks.spec.js` | Real task cards pass claims to their parent, busy state blocks another claim, saved status appears, load errors recover |
| Page integration | `client/src/features/settings/__tests__/FamilySettings.integration.spec.js` | Real page/panels/router/adapters keep the roster and pending selection visible, roll back failed saves, share theme across navigation |
| API/DB integration | `tests/integration/family-api.test.mjs` | Membership boundaries, recipient persistence/archive, admin-only writes, concurrent last-admin protection, leaving, invite rotation/joining, language persistence and logout revocation |
| E2E | `tests/e2e/family-workflows.spec.mjs` | Complete user workflows through Vue, Axios, Express, authentication and MongoDB, at desktop and mobile sizes |
| Existing regressions | `tests/unit/*.test.mjs` | Earlier settings/security/session/cache regression cases |

Tests assert visible output, disabled states, emitted public events and persisted
API results. They avoid checking private Vue refs, function names or large HTML
snapshots. Component/page tests double HTTP only; the API/DB and E2E layers use
real Mongoose models and database queries. A language E2E test pauses a request
with a promise, checks the pending UI, then continues the original real request.
There are no fixed sleeps or fabricated API responses in those browser flows.

## Database isolation

`server/test/support/database.js` creates its own `mongodb-memory-server-core`
instance on 127.0.0.1 in a new temporary directory. Its generated database name
starts with `carecircle_test_`. The app reuses this already connected Mongoose
connection. Test code does not start the production entry point or load `server/.env`.

Fixtures may reset only that generated loopback database. Both the URI and active
connection are checked before any reset. `server/seed.js` is never imported or run.
Playwright runs one worker because each case restores the same test fixture set.
Browser contexts are fresh for every test. API, Vite and MongoDB stop after the run.
Runtime connection details, reports, traces and screenshots are Git-ignored.

## Scope and limits

Passing these tests verifies the implemented flows in an isolated real MongoDB.
It does not verify the team's deployed Atlas configuration, production network,
Telegram delivery, live GPS/OneMap services, LibreTranslate, or a full calendar.
Those integrations are not replaced with passing fake responses. Firefox/WebKit
are not claimed by this suite; the checked projects are Chromium desktop/mobile.

These are regression tests for existing code. They are not evidence that the
existing features were developed with a test-first TDD cycle, and they are not
load tests.

## Course references

- Week 10a, *Intro to Testing*: function tests, Vitest assertions and regression testing.
- Week 10b, *Component and Integration Testing*: isolated component contracts, real child components, and behavior-focused assertions.
- Week 10c, *E2E Testing*: Playwright workflows, async actions and assertions, and failure reports.

Framework references: [Vitest](https://vitest.dev/guide/),
[Vue Test Utils](https://test-utils.vuejs.org/guide/),
[Playwright web servers](https://playwright.dev/docs/test-webserver),
[MongoDB Memory Server](https://typegoose.github.io/mongodb-memory-server/docs/guides/quick-start-guide/).
