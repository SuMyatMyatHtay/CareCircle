# CareCircle testing

For a Korean walkthrough with actual examples, Vitest syntax, props/emits and
the latest main audit, see [Testing explained](TESTING-EXPLAINED.ko.md).
For recurring-task coverage and the local replica-set setup, see
[Running the tests](TESTING-RECURRING.md).

The Week 10 lectures distinguish function/unit tests, isolated component tests,
integration between real components, and complete browser workflows. The tests
here apply that structure to SangYoon's Family Home, Settings and recipient flows.
The test command now discovers every `tests/unit/*.test.mjs`, including main's
assistant, public-profile and profile-picture regressions. The original family
regressions are retained. The focused `test:family` and `test:settings` commands
remain available, while `npm test` runs all Node regressions and Vitest cases.

Verified on **2 November 2026** against main `2081b4d` plus this audit:

| Layer | Passed |
| --- | ---: |
| Node unit/regressions | 148 |
| Test infrastructure guards and fixtures | 2 |
| Vitest function/component/integration tests | 180 |
| Isolated MongoDB API suite | 50 |
| Playwright desktop/mobile Chromium workflows | 62 |
| **Total** | **442** |

Each test layer and `npm run build` passed. This audit adds 24 Vitest cases and
four E2E scenarios run in both browser projects (8 executions). It covers native
invite sharing/fallback/errors, live notification switches/reminders, deletion
permissions, signup/create/join onboarding, and selected overdue deletion.
The notification integration tests reproduced a real bug: the child switches
received preview defaults instead of saved server values. The card now reads
the live settings. Existing Node doubles were updated for reminder bookkeeping;
API/live-trip fixtures now use future times and the repeating-task E2E checks
the real mobile Tasks panel rather than a desktop-only heading.

Earlier integration updates also protect against:

- The log adapter reading the wrong translation response field, and late replies
  showing an old translation after a note edit.
- A late live-trip reply repopulating banners after the selected family is cleared.
- An unconfigured Calendar callback throwing while building a missing redirect URL.

The existing large-bundle advisory remains in Vite's build output. No production
code splitting or new production dependency was introduced in this testing update.

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
| `npm run test:regression` | All Node tests in `tests/unit/`, including new files added by the team |
| `npm run test:client` | Vitest and Vue Test Utils with jsdom |
| `pnpm --dir client test:watch` | Vitest watch mode while editing |
| `npm run test:api` | Real Express routes, JWT authentication, Mongoose and isolated MongoDB |
| `npm run test:e2e` | Playwright on desktop and mobile Chromium, using the real app/API/DB |
| `npm run test:e2e:headed` | The same browser tests with visible browser windows |
| `npm run test:all` | All layers in sequence, then a combined terminal summary |
| `pnpm exec playwright show-report` | The most recent local HTML browser report |

The first DB test downloads a MongoDB binary to its normal machine cache. The
first browser installation downloads Chromium. Later runs reuse these binaries.
E2E tests reserve port 5180 for a test-only Vite server; the API and MongoDB use
free loopback ports. An existing server on 5180 is not reused or stopped.
The E2E server disables HMR/file watching and isolates its dependency cache from
the development server. This prevents a source edit from remounting a page and
clearing transient feedback halfway through a test. Restart tests to use source
edits; this setting does not change the normal development server.

## What each layer verifies

| Layer | Location | Behavior checked |
| --- | --- | --- |
| Function/unit | `client/src/features/family/__tests__/singapore-dates.spec.js` | Singapore midnight/year boundaries and infant birthday calculations |
| Component | `client/src/features/settings/__tests__/FamilyMembersCard.spec.js` | Admin actions, emitted role change, outside click/Escape dismissal, last-admin UI protection, non-admin restrictions, load errors |
| Component | `client/src/features/settings/__tests__/MobileInviteCodeCard.spec.js`, `TaskPermissionsCard.spec.js` | Props/emits, native share cancellation/failure/clipboard fallback, permission saving/rollback, non-admin restrictions and late replies |
| Settings integration | `client/src/features/settings/__tests__/TelegramSettings.integration.spec.js` | Real child switches, composable and adapter use saved settings; pending state, rollback/retry, reminders, family isolation, preview and unlink confirmation |
| Component integration | `client/src/features/family/__tests__/MobileTodayTasks.spec.js` | Real task cards pass claims to their parent, busy state blocks another claim, saved status appears, load errors recover |
| Page integration | `client/src/features/settings/__tests__/FamilySettings.integration.spec.js` | Real page/panels/router/adapters keep the roster and pending selection visible, roll back failed saves, share theme across navigation |
| Log integration | `client/src/features/logs/__tests__/LogCard.integration.spec.js` | Translation response contract, local reuse, late replies after edits, malformed responses and retry |
| Transit integration | `client/src/features/transit/__tests__/active-transit.spec.js` | Family-scoped banners, navigation, delayed replies, selection clearing, preview isolation and polling cleanup |
| Calendar unit | `client/src/features/transit/__tests__/calendar-links.spec.js`, `tests/unit/calendar-oauth.test.mjs` | UTC calendar dates/encoding, user-bound expiring OAuth state, rejection/cancellation and optional configuration |
| API/DB integration | `tests/integration/family-api.test.mjs` | Membership, recipient persistence/archive, roles and last-admin concurrency, invites, profile saving/logout, creator-only task writes, concurrent claims, transit milestones, translation cache/errors and Calendar token privacy |
| E2E | `tests/e2e/*.spec.mjs` | Login/preferences, recipients, tasks/recurrence, logs, calendar and transit; signup/create/join, notification persistence/permissions and selected overdue deletion at desktop/mobile sizes |
| Existing regressions | `tests/unit/*.test.mjs` | Family, assistant proposal/confirmation safety, public profiles, profile pictures, session and cache regressions |

Tests assert visible output, disabled states, emitted public events and persisted
API results. They avoid checking private Vue refs, function names or large HTML
snapshots. Component/page tests double HTTP only; the API/DB and E2E layers use
real Mongoose models and database queries. A language E2E test pauses a request
with a promise, checks the pending UI, then continues the original real request.
There are no fixed sleeps or fabricated application API responses in those browser
flows. Azure translation is simulated only at the external provider boundary;
the real app endpoint, language validation, cache writes and note edits still use
Express, authentication and MongoDB. Provider failures are tested separately.

## Database isolation

`server/test/support/database.js` creates its own `mongodb-memory-server-core`
instance on 127.0.0.1 in a new temporary directory. Its generated database name
starts with `carecircle_test_`. The app reuses this already connected Mongoose
connection. Test code does not start the production entry point or load `server/.env`.

Fixtures may reset only that generated loopback database. All its collections are
cleared between cases, including new transit, assistant and Calendar collections.
Both the URI and active
connection are checked before any reset. `server/seed.js` is never imported or run.
Playwright runs one worker because each case restores the same test fixture set.
Browser contexts are fresh for every test. API, Vite and MongoDB stop after the run.
Runtime connection details, reports, traces and screenshots are Git-ignored.
Exported cloud credentials are disabled for isolated API/E2E processes; the
translation provider double installs explicit test-only values instead.

## Combined terminal summary

Run `npm run test:all` to execute Node regressions, infrastructure tests, Vitest,
API integration and Playwright, then display one **CareCircle Test Summary** table.
It lists passed, failed, skipped and total tests for each suite, with extra
todo/cancelled/flaky columns when needed. The final `N checks passed.` line is
computed from this run's reports. Counts above document an earlier verification;
new tests, including the summary runner's own tests, change the current total.

The orchestrator is `scripts/test-all.mjs`. Node emits a machine-readable global
summary through `scripts/node-summary-reporter.mjs`; Vitest and Playwright use
their JSON reporters alongside their normal terminal output. File/suite counts
and retried attempts are not added as extra tests. Each run uses a fresh
`.test-runtime/test-all-*` directory, so stale successful reports cannot hide a
failed start. The directory also contains the aggregated `summary.json`.

Ordinary suite failures do not stop later suites. The command exits nonzero when
any suite fails, a runner fails outside a test, or a report is missing/invalid.
Missing reports show `-`, an error and a partial known total. Ctrl+C/SIGTERM stops
starting new suites and preserves interruption status. A partial run never claims
that all checks passed. Individual test commands retain their existing behaviour.

## Scope and limits

Passing these tests verifies the implemented flows in an isolated real MongoDB.
It does not verify the team's deployed Atlas configuration, production network,
Telegram delivery, live GPS/OneMap tiles, Azure's translation quality or live
credentials, Gemini/Groq availability, or Google's actual consent/event delivery.
Calendar state/permissions are tested without contacting Google. Existing assistant
tests use Gemini/model doubles. Firefox/WebKit are not claimed by this suite;
the checked browser projects are Chromium desktop/mobile.

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
