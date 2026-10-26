# Testing: Part E (My Tasks & Transit), Chaithra

The tests follow the three Week 10 lessons. They use SangYoon's setup (`docs/TESTING.md`):
Vitest + Vue Test Utils for the client, `node --test` with an isolated MongoDB for the API,
and Playwright for E2E. **No test touches the shared Atlas database.**

| Layer (lesson) | File | Cases |
| --- | --- | --- |
| Unit: plain functions (10a) | `client/src/features/transit/__tests__/calendarLinks.spec.js` | 6 |
| Unit: plain functions (10a) | `client/src/features/my-tasks/__tests__/formatters.spec.js` | 9 |
| Unit: plain functions (10a) | `client/src/features/transit/__tests__/activeTransitBanner.spec.js` | 10 |
| Component (10b) | `client/src/features/my-tasks/__tests__/MyTaskCard.spec.js` | 8 |
| Component (10b) | `client/src/features/transit/__tests__/TransitMobile.spec.js` | 10 |
| Component (10b) | `client/src/features/transit/__tests__/AddToCalendar.spec.js` | 7 |
| Integration: page + child component (10b) | `client/src/features/transit/__tests__/TransitView.integration.spec.js` | 6 |
| API/DB integration | `tests/integration/transit-api.test.mjs` | 14 |
| E2E (10c) | `tests/e2e/transit-workflows.spec.mjs` | 5 × 2 screen sizes = 10 |
| **Total** | | **80** |

Extra test data (a trip task claimed by Alex) is in `server/test/support/transit-fixtures.js`.
It is added on top of SangYoon's `resetFixtures()`, in the generated test database only.

## How to run

From the project folder, after the one-time install steps in `docs/TESTING.md`. Part E's tests
are picked up automatically by the team commands:

```sh
npm test               # Node regressions + all Vitest tests (includes Part E)
npm run test:api       # all API/DB tests (includes tests/integration/transit-api.test.mjs)
npm run test:e2e       # all Playwright tests (includes tests/e2e/transit-workflows.spec.mjs)
npm run test:all       # everything
```

Only Part E:

```sh
pnpm --dir client exec vitest run src/features/transit src/features/my-tasks
node --test tests/integration/transit-api.test.mjs
pnpm exec playwright test tests/e2e/transit-workflows.spec.mjs
```

SangYoon also added two Part E tests of his own (`transit/__tests__/active-transit.spec.js`
and `calendar-links.spec.js`); they run alongside these.

## 1. Unit tests (plain functions)

**calendarLinks.js**: "Add to calendar" links

| Test | Input | Expected output | Purpose |
| --- | --- | --- | --- |
| Google: title, place, family | Task "Physio for Grandpa" at TTSH | URL has the title, "Tan Tock Seng Hospital, 11 Jalan Tan Tock Seng, S308433", family name and notes | The event opens with the right details |
| Google: UTC times | Start 10:00am SGT, end 11:30am | `dates=20261029T020000Z/20261029T033000Z` | Calendar apps get the correct time |
| Google: no end time | `endAt: null` | Event is 1 hour long | Sensible default |
| Google: no location | `location: null` | Empty location | Doesn't crash or print "undefined" |
| Outlook | Same task | Outlook compose URL with subject, start and end | Second calendar option works |
| Apple (.ics) | Same task | Downloads "Physio for Grandpa.ics" with SUMMARY, DTSTART and an escaped LOCATION | Apple Calendar file is valid |

**formatters.js**: Singapore time and names

| Test | Input | Expected output | Purpose |
| --- | --- | --- | --- |
| formatTime morning | `02:00Z` | `10:00am` | UTC is shown as SG time |
| formatTime afternoon | `06:30Z` | `2:30pm` | pm times |
| formatDay | `2026-10-29T02:00Z` | contains "Thu" and "29 Oct" | Day labels on cards |
| dayKey at midnight | `16:30Z` / `15:30Z` | next day / same day | Tasks are grouped by SG midnight, not UTC |
| initials | "Jasmine Tan", "aunt may lim" | "JT", "AM" | Avatar initials |
| initials empty | "" / nothing | "" | No crash |
| recipientName | nickname + name / name only | "Grandpa" / "Baby Emma" | Shows the family's name for the person |
| recipientName missing | null / id string / null task | "" | Household tasks and unloaded data |
| familyColour | same family id twice | same colour, one of the 4 | Family pills stay consistent |

**useActiveTransit.js `toBanner()`** + **wording.js**: Family Home live trip banner

| Test | Input | Expected output | Purpose |
| --- | --- | --- | --- |
| No updates yet | trip with no steps | "Grandpa's trip has started", "0 of 5 milestones · next: arrived at clinic" | Banner before the first update |
| After departing | "departed" | "Grandpa is on the way to Tan Tock Seng Hospital", "1 of 5" | Shows where they're going |
| Custom update | "Collecting medicine" | "Grandpa: Collecting medicine", still "1 of 5" | Custom text shown; not counted as a fixed step |
| Several steps | departed, arrived, consultation done | "Grandpa's consultation is done", "3 of 5 · next: heading home" | Progress count and next step |
| Ids kept | any trip | familyId and taskId kept | Tapping the banner opens the right trip |
| Right faces | Grandpa + Jasmine, no photo chosen | grandpa.png, jasmine.png | Not everyone shown as the default face |
| Own photo kept | companion with a photo | that photo | Doesn't override a chosen picture |
| No trip | `null` | `null` | Nothing to show |
| Fixed steps | `TRIP_STEPS` | 5 steps in order, last = "Safely back home" | Laptop and phone use the same steps |
| Quick updates | "Grandpa" / "" | "Picked up Grandpa" / "Picked up", 4 items | Wording names the person |

## 2. Component tests (one component on its own)

**MyTaskCard.vue**: one task on My Tasks

| Test | Input (props) | Expected output | Purpose |
| --- | --- | --- | --- |
| Details | claimed trip task | title, family, 10:00am, place, "for Grandpa" | Card shows the essentials |
| Claimed trip | status claimed, needsTransit | "Give back" and "Start the trip"; clicks emit `give-back` / `start` | Right actions for a claimed trip |
| Claimed, no travel | needsTransit false | "Start task", no "Start the trip" | Wording depends on the task |
| In progress | status in_progress | "In transit"; "Open the trip" emits `open-trip`; "Mark as done" emits `complete` | Actions during a trip |
| Done | status completed | "Done" and only "View trip" | Can't redo a finished task |
| Busy | `busy: true` | buttons disabled | No double clicks while saving |
| Closed card | `expanded: false` | no buttons; tap emits `toggle` | Cards open on tap |
| Reminder | reminder "In 30 min" | reminder shown instead of the status | Soon/late flag |

**TransitMobile.vue**: phone Transit mode (map stubbed)

| Test | Input (props) | Expected output | Purpose |
| --- | --- | --- | --- |
| Not started | no trip, canStart | "Start the trip" emits `start` | Claimer can begin |
| Follower | live trip, not companion | "Only Jasmine can post updates", no chips, no × | Only the companion posts |
| Suggested chips | departed + "Picked up Grandpa" posted | first chip "Arrived at clinic", posted one hidden, 4 chips | Guides the next update |
| Tap chip | first chip | emits `post` {departed, "Departed home"} | Quick updates |
| Typed update | "  Waiting at pharmacy  " | emits trimmed text, box cleared; blank can't send | Own updates |
| Safely home | Cancel, then OK | nothing posted, then posts `home` | Confirmation before finishing |
| Remove (×) | companion, wrong update | emits `remove` with that step | Fix mistakes |
| Finished | ended + completed | "…safely back home. The task is done.", no × on home, no chips | Final state |
| Resume | ended, canResume | "Trip ended…", "Resume the trip" emits `resume` | Undo an accidental end |
| Other trips | another live trip | "Alex · Grandma is heading home"; tap emits `open-trip` | Switch between family trips |

**AddToCalendar.vue**: pop-up (only the Google sync status call is doubled)

| Test | Input | Expected output | Purpose |
| --- | --- | --- | --- |
| Closed | `modelValue: false` | no dialog | Hidden until asked |
| One task | one task, open | title, place, Google/Apple/Outlook; Google link has the title | Main use |
| Close | Escape, then close button | emits `update:modelValue` false twice | Keyboard and button close |
| Several tasks | 2 tasks | 2 rows with app buttons | My Tasks "Add to calendar" |
| Sync on, my task | Google connected, claimed by me | "Already added automatically (sync is on)" | No duplicate events |
| Sync on, not mine | claimed by someone else | Google link still offered | Only my tasks sync |
| No tasks | empty list | "No upcoming tasks to add." | Empty state |

## 3. Integration test (real page + real child component)

**TransitView.vue + TransitMobile.vue** (phone layout). Only HTTP is doubled by a small
in-memory "server"; a tap in the child goes through the page and back.

| Test | Input | Expected output | Purpose |
| --- | --- | --- | --- |
| Start | Jasmine taps "Start the trip" | API called; "Live" and "Post the next update" appear | Start flow works end to end in the client |
| Post updates | chip + typed "Stuck in traffic" | timeline: Departed home, Stuck in traffic | Saved updates show on the timeline |
| Remove | typed "asdfgh", × then OK | gone from timeline, "Update removed." | × removal flow |
| Safely home | button, OK | "…The task is done.", "Ended", button gone | Finishing a trip |
| Follower | Alex opens Jasmine's trip | sees the step, "Only Jasmine can post updates", no chips | Family can follow, not post |
| Server error | API answers 403 | the server's message shown, timeline unchanged | Errors are shown, not hidden |

## 4. API/DB integration (Express + login + isolated MongoDB)

| Test | Expected | Purpose |
| --- | --- | --- |
| Start a claimed trip task | 404 before; then task in_progress, trip active, companion = Alex; family can GET it | Start creates the live trip |
| Post updates | saved in order; preset label filled; server sets the time (sent time ignored) | Trustworthy timeline |
| Bad updates | unknown type, blank custom, 81 chars → 400; nothing saved | Validation |
| Companion only | Jasmine/May can't post, end, remove or share location (403) | Permissions |
| Outsiders | other family 403, not logged in 401 | Family privacy |
| Remove | wrong update removed; again 404; bad time 400; "Safely back home" 409 | × rules |
| Safely back home | task completed, trip ended, later updates 409 | Finishing |
| End + resume | task stays in progress; resume keeps steps; double end/resume 409 | Undo accidental end |
| No resume when done | completed task → 409 | Can't reopen a finished task |
| Live location | lastLocation and trail saved; family sees them | Live map data |
| Bad coordinates / ended | 400 with 2 errors; after end 409 | Location validation |
| Start again | old steps, trail and location cleared | New trip starts clean |
| Family live trips | banner list shows the trip with recipient; bad status 400; other family sees none | Family Home banner |
| My Tasks | `claimedBy=me` returns my task, not the unclaimed one | My Tasks list |

## 5. E2E (Playwright, desktop and phone)

| Test | Steps | Expected | Purpose |
| --- | --- | --- | --- |
| Start and post | Alex logs in → My Tasks → Start the trip → "Departed home" → types an update → reload | Live trip; both updates still there after reload; location note shown | Main companion workflow |
| Remove with × | post "asdfgh" → × → OK → reload | gone, stays gone | Fixing a mistake |
| Safely back home | post → Safely back home → OK → My Tasks Done tab | "Ended", done message, no update box; task under Done | Finishing the task |
| Family follows | Alex starts via API; Jasmine logs in → Family Home banner → open | banner text; timeline; "Only Alex can post updates"; no box, no × | Family view |
| Not the claimer | Jasmine opens Alex's not-started trip | no "Start the trip" | Only the claimer starts |

OneMap map pictures and the OSRM road lookup are switched off in E2E (outside services);
the live map's pins and trail data are covered by the API tests.

## Results (26 Oct 2026, on main with SangYoon's test setup)

All Part E tests pass: 56 Vitest, 14 API, 10 Playwright (5 workflows × desktop and phone).
The whole team suite also passes with them added: `npm test` (78 Node + 84 Vitest),
`npm run test:api` (30), `npm run test:e2e` (26), and `npm run build`.
