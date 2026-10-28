# CareCircle API contract

All endpoints, by package. **Implemented** means the endpoint is merged and tested; **Planned** means it is agreed but not built. If you change an endpoint, update this file in the same PR. Owners are listed in [OWNERSHIP.md](OWNERSHIP.md).

| Pkg | Owner | Base path | Status |
|---|---|---|---|
| A | Sera | `/api/auth`, `/api/families` | Planned (middleware and models done) |
| B | SangYoon | `/api/families/:familyId` (members, invitations); language via A's `/api/auth/me` | Member/invite code complete with local HTTP tests; MongoDB integration pending |
| C | Jhen | `/api/families/:familyId/recipients` | Implemented |
| D | Marcus | `/api/families/:familyId/tasks` | Planned (model and routes done; controller stubs return 501) |
| E | Chaithra | `/api/me/tasks`, `/api/me/google`, `/api/families/:familyId/tasks/:taskId/transit`, `/api/families/:familyId/transit`, `/api/integrations/clinics` | Implemented |
| F | SeungHak | `/api/families/:familyId/logs`, `/api/families/:familyId/notifications`, `/api/integrations` | Logs and voice transcription implemented; notifications and Telegram planned |

Every package router is mounted in `server/src/routes/index.js` at the path listed in this file. Endpoints that are still placeholders return `501`.

---

## Conventions

**Base URL.** Express runs on `http://localhost:3000`. In development the Vue app calls `/api/...` and Vite proxies it. `GET /api/health` returns `{ status: 'ok' }`.

**Authentication.** Log in to get a JWT, then send it on every request:

```
Authorization: Bearer <token>
```

The token is signed with `jwt.sign({ userId }, process.env.JWT_SECRET)`; `requireAuth` reads `userId` from it. `services/http.js` should add this header to every request.

**Tenancy.** Family data lives under `/api/families/:familyId/...`. Each of these routes runs `requireAuth` and then `requireFamilyMember`, which:
- loads the family;
- returns 404 if it doesn't exist, or 403 if the user isn't a member;
- sets `req.user`, `req.family` and `req.memberRole` (`admin` or `member`).

Always filter queries by `family: req.family._id`. Never take a family ID, user ID or role from the request body.

**Requests and responses**
- Bodies are JSON in both directions.
- IDs are MongoDB `_id` strings.
- References are named after the thing they point to: `recipient`, `claimedBy`, not `recipientId`.
- Dates are ISO 8601 strings in UTC, e.g. `2026-10-10T02:00:00.000Z`. Convert to Singapore time only in Vue.
- Responses wrap the data in a named key: `{ task }`, `{ tasks }`, `{ recipient }`, `{ recipients }`. A bare array is never returned.
- When a reference is populated, it comes back as a small object, e.g. `claimedBy: { _id, name, telegramUsername }`. When it isn't set, it is `null`.

**Errors.** Every error response looks like this:

```json
{ "error": "Validation failed", "errors": ["Title is required"] }
```

`errors` is only present for validation failures.

| Status | Meaning |
|---|---|
| 400 | Invalid input |
| 401 | Not logged in, or the token is invalid |
| 403 | Logged in, but not allowed (not a member, or wrong role) |
| 404 | Not found in this family. A malformed ID also returns 404. |
| 409 | Conflict: someone else changed it first, or the action isn't allowed in its current state. Refresh, then show the latest state. |
| 501 | Placeholder, not implemented yet |

**Enums and event names** live in `server/src/constants.js`. Import them; don't hard-code strings.

---

## A: Authentication & Families (Sera)

| Method | Path | Who | Body | Response | Status |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | public | `{ name, email, password, preferredLang? }` | `201 { token, user }` | Planned |
| POST | `/api/auth/login` | public | `{ email, password }` | `{ token, user }`; `401` if wrong | Planned |
| POST | `/api/auth/logout` | logged in | none | `204`. JWTs are stateless, so the client deletes its token. | Planned |
| GET | `/api/auth/me` | logged in | none | `{ user }` | Planned |
| GET | `/api/families` | logged in | none | `{ families: [{ _id, name, role, memberCount }] }`, used by the family switcher | Planned |
| POST | `/api/families` | logged in | `{ name, relationship? }` | `201 { family }`. The creator becomes `admin`, and a 6-character `inviteCode` is generated. | Planned |
| POST | `/api/families/join` | logged in | `{ inviteCode, relationship? }` | `{ family }`. `404` for an unknown code, `409` if already a member. | Planned |
| GET | `/api/families/:familyId` | member | none | `{ family }`, with member names populated | Planned |

- **`user` never includes `passwordHash`.** The schema marks it `select: false`.
- **Already done:**
  - Middleware: `requireAuth`, `requireFamilyMember`, `requireFamilyAdmin` in `server/src/middleware/authMiddleware.js`.
  - Models: `UserModel.js`, `FamilyModel.js` in `server/src/models/`.
  - Remaining work: the routes above, and hashing passwords with bcrypt on register.
- **Seed users:** `alex@`, `jasmine@`, `may@` and `mia@carecircle.test`, password `password123`. Family invite code: `7925C4A333`.

---

## B: Family Dashboard & Settings (SangYoon)

| Method | Path | Who | Body | Response | Status |
|---|---|---|---|---|---|
| GET | `/api/families/:familyId/members` | member | none | `{ members: [{ user: { _id, name, email, preferredLang, telegramUsername }, role, joinedAt }] }` | Code + local HTTP tests; live DB pending |
| PATCH | `/api/families/:familyId/members/:userId` | admin | `{ role }` | `{ member }`. `409` if it would remove the last admin or access changed during the request. | Code + local HTTP tests; live DB pending |
| DELETE | `/api/families/:familyId/members/:userId` | admin, or the user themself (leaving) | none | `204`. `409` if it would remove the last admin or access changed during the request. | Code + local HTTP tests; live DB pending |

Family names are set at creation and cannot be changed. There is no family-renaming endpoint.
| POST | `/api/families/:familyId/invite-code` | admin | none | `{ inviteCode }` (10 hexadecimal characters; the old one stops working) | Code + local HTTP tests; live DB pending |
| PATCH | `/api/users/me` | logged in | `{ name?, phone?, preferredLang?, telegramUsername? }` | `{ user }` | Planned |

- **Dashboard:** Family Home doesn't need its own endpoint. It shares C's `GET /recipients` and D's `GET /tasks` query caches with the recipient pages, then filters the seven-day active-task window locally.
- **Light and dark mode:** handled in the browser only, saved in `localStorage`. No API.
- **`preferredLang`:** a LibreTranslate language code, e.g. `en` or `zh`. F's logs use it to decide which translation to show.
- **Current UI language save:** uses the existing `PATCH /api/auth/me` endpoint. It fetches `/api/auth/me` first and sends the complete profile fields required by A's controller. `/api/users/me` remains planned.
- **Current membership schema:** contains `userId`, `role`, `joinedAt`; no relationship field. The role endpoint accepts only `role` and rejects additional fields. Relationship editing requires an agreed schema extension with A.
- **Dashboard implementation:** Home filters active tasks from Singapore midnight to seven days later, shows today's tasks, and polls every 20 seconds while visible. Persistent activity, active transit and Telegram preference delivery remain E/F integration work. See [FAMILY-UI.md](FAMILY-UI.md).

---

## C: Care Recipient Management (Jhen)

Base: `/api/families/:familyId/recipients`

| Method | Path | Who | Body | Response | Status |
|---|---|---|---|---|---|
| GET | `/` | member | Query: `includeArchived=true` (optional) | `{ recipients }`, sorted by `name`, `linkedUser` populated. Active only by default. | Implemented |
| POST | `/` | member | `{ name, nickname?, careType, dateOfBirth?, mobility?, allergies?, conditions?, dietaryRestrictions?, medications?, emergencyContacts?, preferredClinic?, careNotes?, linkedUser? }` | `201 { recipient }`. Always `isActive: true`; `family` and `isActive` in the body are ignored. | Implemented |
| GET | `/:recipientId` | member | none | `{ recipient }`, `linkedUser` populated | Implemented |
| PATCH | `/:recipientId` | member | any of the POST fields, including `linkedUser?` | `{ recipient }`. `family`, `isActive` and timestamps can't change; an empty body is `400 Nothing to update`. New or edited `medications` entries get `updatedBy` and `updatedAt`. Will send `medication.changed` if the list changed, once `notify()` exists. | Implemented |
| POST | `/:recipientId/archive` | admin | none | `{ recipient }` with `isActive: false` and `linkedUser: null`, so the account can be linked again. Archiving twice just returns it. Recipients are archived, never deleted. | Implemented |

- **Model:** `server/src/features/recipients/CareRecipient.model.js`, registered as `CareRecipient` in the `carerecipients` collection. C owns it.
- **`linkedUser`:** optional user id for a recipient who also has an account (e.g. a pregnant member). `null` or `''` unlinks, and anyone can do that. You can only link your own account (`403` otherwise); re-sending the current link unchanged is fine. Infant recipients can't be linked, including changing a linked recipient's `careType` to `infant` (`400`). It must be a member of this family, otherwise `400`. One account links to at most one recipient per family; a second link returns `409`.
- **Sub-documents:** `mobility: { level, notes }`, `allergies: [{ name, severity }]`, `medications: [{ name, dosage, frequency, startDate, notes }]`, `emergencyContacts: [{ name, relationship, phone }]`, `preferredClinic: { name, address, postal, lat, lng }`. Sending `null` for a list clears it. `updatedBy`/`updatedAt` on medications are set by the server.
- **Overview tab:** combines D's `GET /tasks?recipient=<id>&from=<now>`, F's `GET /logs?recipient=<id>&limit=1`, and this profile.
- **Tasks tab:** "Add task" goes to D's form with the recipient filled in. C doesn't need a task endpoint.

---

## D: Task Management (Marcus)

Base: `/api/families/:familyId/tasks`. **Implemented.**
- Routes, model and handlers live in `server/src/features/tasks/`.
- Local API integration tests exercise persistence, creator-only writes, concurrent claims and transit completion. Deployment and external notifications are separate validation work.

| Method | Path | Who | Body / query | Response |
|---|---|---|---|---|
| GET | `/` | member | Query (all optional): `status=open,claimed`, `recipient=<id>` or `none` (household tasks), `claimedBy=me` or `<userId>`, `from=<date>`, `to=<date>` (on `startAt`) | `{ tasks }`, sorted by `startAt` |
| GET | `/:taskId` | member | none | `{ task }` |
| POST | `/` | member | `{ title, startAt, endAt?, description?, category?, recipient?, location?, needsTransit? }` | `201 { task }`, always `open`. Sends `task.created`. |
| PATCH | `/:taskId` | creator only | any subset of the fields above | `{ task }`. `status` and `claimedBy` are ignored. `409` once a task is completed or cancelled. |
| DELETE | `/:taskId` | creator only | none | `200 { message, taskId }`. `409` for `in_progress` and `completed` tasks; cancel those instead. |
| POST | `/:taskId/claim` | member | none | open → claimed. `409 { error: 'Task already claimed' }` if someone got there first. Sends `task.claimed`. |
| POST | `/:taskId/unclaim` | creator or claimer | none | claimed → open. Sends `task.unclaimed`. |
| POST | `/:taskId/start` | claimer | none | claimed → in_progress, `{ task, transitSession }`. A transit session is created only when `needsTransit` is true. |
| POST | `/:taskId/complete` | claimer | none | claimed or in_progress → completed. Ends any transit session. Sends `task.completed`. |
| POST | `/:taskId/cancel` | creator, claimer or admin | none | open, claimed or in_progress → cancelled. Ends any transit session. Sends `task.cancelled`. |

**Task shape**

```json
{
  "_id": "…", "family": "…",
  "recipient": { "_id": "…", "name": "Tan Ah Kow", "nickname": "Grandpa", "careType": "elderly" },
  "title": "Eye check-up", "description": "…", "category": "appointment",
  "startAt": "2026-10-09T02:00:00.000Z", "endAt": "2026-10-09T03:30:00.000Z",
  "location": { "name": "TTSH Eye Centre", "address": "…", "postal": "308433", "lat": 1.32, "lng": 103.84 },
  "needsTransit": true, "status": "in_progress",
  "createdBy": { "_id": "…", "name": "Aunt May", "telegramUsername": "auntmay" },
  "claimedBy": { "_id": "…", "name": "Jasmine Tan", "telegramUsername": "jasminetan" },
  "claimedAt": "…", "completedAt": null, "createdAt": "…", "updatedAt": "…"
}
```

**Enum values**
- `category`: `appointment`, `therapy`, `errand`, `groceries`, `childcare`, `medication`, `companionship`, `other`.
- `status`: `open`, `claimed`, `in_progress`, `completed`, `cancelled`. In the UI, `open` is shown as "Available".

### Live updates (Socket.IO): Planned

Proposal: the frontend updates the list in place from socket events. It doesn't reload the page, and it doesn't refetch on every event.

1. After login, the client connects with `io({ auth: { token } })` and emits `family:join` with `familyId`. The server checks the user is a member before adding them to room `family:<familyId>`.
2. After every successful task write, the server emits to that room:

| Event | Payload | Client does |
|---|---|---|
| `task.created` | `{ task }` | Add it to the list if it matches the current filter |
| `task.updated` | `{ task }` | Replace by `_id`, or add it if it now matches the filter |
| `task.claimed`, `task.unclaimed`, `task.completed`, `task.cancelled` | `{ task }` | Same as `task.updated` |
| `task.deleted` | `{ taskId }` | Remove by `_id` |

3. On reconnect, refetch the current list once, in case events were missed while offline.
4. Each `{ task }` payload has the same shape as the REST response, so one `upsertTask(task)` function in the Vue store handles all of them.

`task.updated` and `task.deleted` are socket-only: they never send Telegram messages. Add them to `constants.js` before using them.

---

## E: My Tasks & Transit (Chaithra)

### My Tasks (across all families)

| Method | Path | Who | Query | Response | Status |
|---|---|---|---|---|---|
| GET | `/api/me/tasks` | logged in | `status=claimed,in_progress,completed`, `from`, `to` (all optional) | `{ tasks }` (task shape above, plus `family: { _id, name }`), sorted by `startAt` | Implemented |

- **Scope:** only `requireAuth` (no `familyId`). Filters on `claimedBy = req.user.userId` and on `family` being one of the user's families, so a user who left a family stops seeing its tasks.
- **Tabs:** Upcoming = `claimed`, In Progress = `in_progress`, Completed = `completed`.
- **"Due soon" flag:** worked out in the client (`startAt` within the next 24 hours). F's Telegram reminders handle the push side.
- **Actions on My Tasks** use D's endpoints: Start task = `POST /start`, Give back = `POST /unclaim`, Mark as done = `POST /complete`.
- Opening My Tasks also refreshes the user's Google Calendar (at most once a minute; see Google Calendar sync).
- **Code:** `server/src/features/my-tasks/`, mounted at `/api/me` in `routes/index.js`. Reads D's `tasks` collection only.

### Transit

Base: `/api/families/:familyId/tasks/:taskId/transit` (mounted before D's tasks router, `Router({ mergeParams: true })`).

| Method | Path | Who | Body | Response | Status |
|---|---|---|---|---|---|
| GET | `/api/families/:familyId/transit?status=active` | member | none | `{ transitSessions }` with task and companion populated, newest first. `status` is `active` or `ended` (optional). For the live banner on Home. | Implemented |
| GET | `/` | member | none | `{ transitSession }` (includes `lastLocation` and `path`); `404` if the task has no session | Implemented |
| POST | `/milestones` | companion | `{ type, label?, lat?, lng? }` | `201 { transitSession }`. The server sets `at`. `403` if not the companion, `409` if the trip has ended. | Implemented |
| DELETE | `/milestones?at=<step at>` | companion | none | `{ transitSession }` without that step. For removing a mistake (e.g. a typo). `404` if no step has that `at`, `409` for "Safely back home" (it completed the task). | Implemented |
| POST | `/end` | companion | none | `{ transitSession }` with `status: 'ended'`. "End transit": stops the trip **without** completing the task (it stays `in_progress`). `409` if already ended. | Implemented |
| POST | `/resume` | companion | none | `{ transitSession }` back to `active`, keeping its steps. Undoes an accidental End transit. `409` unless the task is still `in_progress` and the trip has ended. | Implemented |
| PATCH | `/location` | companion | `{ lat, lng }` | `{ lastLocation }`. Sent every ~20 s by the companion's browser while active. Also adds the point to `path`. `403` if not the companion, `409` if ended. | Implemented |

- **Starting a session:** D's `POST /tasks/:taskId/start` creates it (`TaskModel.startTransitSession`). Starting again after an unclaim is a new journey: steps, `path`, `lastLocation`, `startedAt` and `endedAt` are reset. E never creates a session directly.
- **Step types:** `MILESTONE_TYPES` = `departed`, `arrived`, `consultation_done`, `heading_home`, `home`, `custom`. Preset steps send a type (label optional; the server fills a default). Custom steps send `type: 'custom'` and the text the user typed as `label` (required, max 80 characters).
- **UI presets** (Transit mode chips): "On the way to fetch …" (`departed`), "Fetched …" (custom), "Reached hospital" (`arrived`), "Seeing the doctor", "Collecting medicine", "Going for lunch" (custom), "Heading home" (`heading_home`), "Safely back home" (`home`).
- **"Safely back home":** completes the task **first** through D's exported `completeTask()` (same rules as `POST /complete`). If that fails, nothing has been saved and the error is returned. Then the home step, `status: 'ended'` and `endedAt` are saved in one update (retried once).
- **Live location and trail:** `lastLocation` is the latest position; `path` is the trail drawn on the map (`[{ lat, lng, at }]`, oldest first, capped at 500 points). A gap over 150 m is filled in along the roads (OSRM, OpenStreetMap routing, no API key); an impossible jump (over 2 km at over 120 km/h) starts the trail again. Browsers only share location while the Transit page is open, so the UI shows "Location paused" after 2 minutes without an update.
- **Live timeline:** Transit mode polls `GET /` every 10 seconds while the trip is active (Socket.IO isn't set up, and the server runs serverless). When F's `notify()` exists, replace `announce()` in `journeys/controller.js` with `notify(familyId, 'transit.milestone', { transitSession })`.
- **Model:** `server/src/features/journeys/Journey.model.js`, registered as `TransitSession` (collection `transitsessions`). E owns it.
- **Demo helper:** `node server/simulate-trail.js [taskId]` draws a pretend trail on an active trip (for testing and demos).

### Google Calendar sync

| Method | Path | Who | Body | Response | Status |
|---|---|---|---|---|---|
| GET | `/api/me/google` | logged in | none | `{ available, connected, email, lastSyncedAt, lastError }`. `available: false` when the server has no Google settings. | Implemented |
| GET | `/api/me/google/connect` | logged in | none | `{ url }`: Google's sign-in page. `503` if not set up. | Implemented |
| GET | `/api/google/callback` | public (Google redirects here) | `code`, `state` | Saves the link, syncs, then redirects to `/my-tasks?calendar=connected` (or `cancelled` / `error`). | Implemented |
| POST | `/api/me/google/sync` | logged in | none | `{ connected, added, updated, removed }`. `502` if Google can't be reached. | Implemented |
| DELETE | `/api/me/google?removeEvents=true` | logged in | none | `204`. Stops syncing; with `removeEvents=true` also deletes the CareCircle events. | Implemented |

- **What syncs:** the user's tasks that are `claimed`, `in_progress` or `completed` (from the last 30 days on) appear in their Google Calendar; given back, cancelled, deleted or left-family tasks are removed. Completed tasks get a ✓.
- **When:** after any successful change to a task (`calendarAutoSync` middleware in front of D's tasks router, so D's code doesn't change), after "Safely back home", when the user opens My Tasks, and on "Sync now".
- **Server settings** (`server/.env`, never committed): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=http://localhost:5173/api/google/callback`; deployed, also `APP_URL=<website address>` if the website and API are on different addresses. While the Google app is in testing, only Gmails added as test users can connect.
- **Model:** `server/src/features/calendar-sync/GoogleCalendarLink.model.js` (collection `googlecalendarlinks`): refresh token (never sent to the browser), Google email, and taskId → event id.
- **Code:** `server/src/features/calendar-sync/`, `client/src/features/my-tasks/components/GoogleCalendarSync.vue`.

### Clinic search (OneMap, CC-19)

| Method | Path | Who | Query | Response | Status |
|---|---|---|---|---|---|
| GET | `/api/integrations/clinics` | logged in | `q` (at least 2 characters) | `{ clinics, otherPlaces }`: each `[{ name, address, postal, lat, lng }]`. `clinics` are medical places (up to 10); `otherPlaces` (up to 5) are shown only when no clinic matched. `502` if OneMap is down. | Implemented |
| POST | `/api/integrations/transcribe` | logged in | Raw audio body (`Content-Type: audio/webm`, `audio/mp4`, ...), max 4 MB | `{ text }`. Uses Groq Whisper. `429` if Groq's rate limit is hit, `502` if Groq is down, `503` if `GROQ_API_KEY` is not set. | Implemented |

- Calls OneMap's public search API from the server. `lat`/`lng` are numbers and `postal` is 6 digits or `''`, so a result can be saved as `task.location` directly.
- Frontend: `client/src/features/transit/components/ClinicSearch.vue` emits `select` with the location. D can use it in the task form: `<ClinicSearch @select="(loc) => (form.location = loc)" />`.

### Shared components and pages

All in `client/src/features/transit/components/`:

- **`TaskLocationCard.vue`** (`:task`): OneMap map, address and Directions button. For D's Task detail page.
- **`TaskTransitActions.vue`** (`:task`): Start transit / Open transit, live milestone, Add to calendar. Has `#middle` and `#end` slots for D's own buttons. For D's Task detail page.
- **`AddToCalendar.vue`** (`v-model`, `:tasks`): pop-up with Google Calendar / Apple Calendar / Outlook buttons for one or more tasks.
- **`OneMapTiles.vue`**: the OneMap map, with optional destination pin, companion photo pin + bubble, and trail.
- **`LiveTransitBanner.vue`** (`:family-id`): "on the way" banner, polls every 15 s. For B's Family Home, replacing the TransitBanner placeholder.

Pages: `/my-tasks` (My Tasks, with "Connect Google Calendar" and "Add to calendar") and `/transit/:familyId/:taskId` (Transit mode).

**Temporary:** `client/src/features/transit/views/TaskDetailView.vue` at `/families/:familyId/tasks/:taskId` is a stand-in until D's Task detail page is ready. D can delete it and point the route to his own view.

---

## F: Care Logs & Integrations (SeungHak)

### Care logs

Base: `/api/families/:familyId/logs`

| Method | Path | Who | Body / query | Response | Status |
|---|---|---|---|---|---|
| GET | `/` | member | Query: `recipient=<id>`, `before=<date>`, `limit` (1–50, default 20) | `{ logs }`, newest first, `author` populated | Implemented |
| POST | `/` | member | `{ recipient, type, content, task?, consultation?, medicationChanges?, inputMethod?, originalLang?, notify? }` | `201 { log }`. `author` is the logged-in user. `consultation` is kept only when `type` is `consultation`. Will send `log.created`, plus `medication.changed` if `medicationChanges` is set, once `notify()` exists; `notify: false` skips both. | Implemented |
| GET | `/:logId` | member | Query: `lang=zh` (optional) | `{ log }`. `lang` / `translatedContent` is not built yet: each translation will be cached in `translations`, so a text is translated only once. | Implemented (without `lang`) |
| PATCH | `/:logId` | author or admin | `{ content?, type?, consultation?, medicationChanges? }` | `{ log }`. Changing `content` clears the cached translations; changing `type` away from `consultation` clears `consultation`. `recipient`, `task`, `author` and `inputMethod` can't change. | Implemented |
| DELETE | `/:logId` | author or admin | none | `204` | Implemented |

Log `type` values: `consultation`, `medication_change`, `diet`, `symptom`, `general`.

### Calendar

The calendar uses D's `GET /tasks?from=<month start>&to=<month end>`, so it needs no new endpoint.

Optional: `GET /api/families/:familyId/calendar.ics` exports the tasks for Google Calendar.

### Telegram

| Method | Path | Who | Body | Response | Status |
|---|---|---|---|---|---|
| POST | `/api/integrations/telegram/webhook` | Telegram only (check the secret token header) | Telegram update | `200`. Handles `/link <inviteCode>` and sets `family.telegram`. | Planned |
| GET | `/api/families/:familyId/notifications` | member | none | `{ notifications }`, newest first | Planned |
| PATCH | `/api/families/:familyId/notify-settings` | admin | `{ notifyOn: [eventType] }` | `{ notifyOn }` | Planned |

- **Calling `notify()`:** `notify(familyId, eventType, payload)` in `server/src/utils/notify.js` is a stub that only logs. Keep its signature when replacing it. Every package calls it.
- **Outbox:** `notify()` should save an entry in `notifications` and then send it. Its status is `skipped` when no chat is linked or the event is muted.
- **Message text:**
  - Every message ends with a deep link to the related page.
  - Keep health details out of the text, because group chats get forwarded. Write "Grandpa's medication was updated", not the drug and dose.
- **Reminders:** a scheduled job sends reminders for tasks starting soon.

---

## Assistant task proposals

All assistant routes require authentication and membership of `:familyId`.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/families/:familyId/assistant/chat` | `{ messages, selectedTaskId?, selectTask?, editField? }` | `{ message, suggestions, tasks?, proposal?, editField? }` |
| POST | `/api/families/:familyId/assistant/proposals/:proposalId/confirm` | none | `{ task }`, `{ deleted, taskId }`, or `{ requiresSecondConfirmation, message }` |
| POST | `/api/families/:familyId/assistant/proposals/:proposalId/cancel` | none | Dismisses a pending proposal without changing a task |

Supported proposal actions: `create`, `update`, `claim`, `assign`, `unclaim`, `start`, `complete`, `cancel`, `delete`. All writes require confirmation. Deletion requires two confirmations. Confirmation accepts a proposal ID, never a replacement task payload.

Claim acts for the signed-in person. Assign requires task-creator ownership and a current family-member assignee. Claim/assign require an open task before its start time. Start/complete require the current claimer. Assistant cancellation requires creator or claimer ownership; admin status alone does not qualify. Unclaim requires creator or claimer and claimed status. Update/delete remain creator-only. Confirmation rechecks current state and the original task version, returning a conflict for stale proposals. Status actions share the manual task/transit lifecycle.

`selectedTaskId` explicitly anchors a follow-up to a family task. `selectTask: true` returns a clarification without a provider call. Change time/location follow-ups also ask for the new value directly. Empty model edits never create a proposal.

## Recurring tasks

These endpoints use the existing authenticated family membership middleware. Recurring writes require MongoDB Atlas or a replica set (transactions); standalone MongoDB returns `503` for those writes.

`POST /api/families/:familyId/tasks` accepts the normal task fields plus an optional rule:

```json
{
  "recurrence": {
    "frequency": "weekly",
    "interval": 1,
    "weekdays": [1, 4],
    "end": { "mode": "on", "until": "2026-12-18" }
  }
}
```

Frequencies: `daily`, `weekly`, `monthly`; interval is an integer 1–365. Weekdays use Monday=0 through Sunday=6. End modes: `never`, `on` with a Singapore `YYYY-MM-DD` date, or `after` with `count` 1–500. Finite end dates must be within five years and produce at most 500 sessions. Monthly schedules skip months without the selected day. Omitting recurrence or using `frequency: "none"` preserves ordinary task creation.

Creation returns `{ task }`, the first occurrence, retaining the existing response shape. Refetch the family task list to retrieve every generated occurrence. Each has `recurringSeries`, `occurrenceIndex`, `originalStartAt`, `recurrenceLabel`, `recurrenceDetached` and `recurrencePaused`. Occurrence indexes are stable; deletions leave tombstones. An open-ended series extends four weeks ahead when the family task list, series list or My tasks is read.

- `POST /:taskId/claim` accepts `{ "scope": "series" }` (default), `one`, or `next4`. Series claims reserve every attached open future occurrence and future generated sessions; next4 takes this and up to three later available attached dates. Limited claims detach those dates. Already assigned sessions are never overwritten.
- `POST /:taskId/unclaim` releases only that occurrence and permanently detaches it. Any later claim of a detached occurrence is forced to `one`, regardless of supplied scope. Creator/claimer permissions and overdue restrictions still apply.
- `PATCH /:taskId` accepts ordinary editable fields, optional `expectedUpdatedAt` and `scope`: `one` (default), `future`, or `all`. The creator can edit selected/upcoming attached sessions; started, completed, cancelled and independent sessions are preserved. Detached dates accept only `one`. A series-wide time change preserves occurrence dates; moving to another date requires `one`. Recurrence rule changes are not supported by this endpoint.
- `GET /recurring` returns `{ series: [...] }` with template, rule, creator, usual helper and pause status.
- `PATCH /recurring/:seriesId` accepts `{ "paused": true }` or `false`, creator only. Pause cancels attached future open/claimed sessions with a pause marker. Resume restores only those marked sessions and extends generation. Historical and detached sessions remain unchanged.

Complete/start/cancel/delete apply to one occurrence. Assistant claim/assign defaults to the series; assistant updates apply to one occurrence. Existing event notifications remain event-triggered; this feature does not schedule Telegram reminders.

## Cross-module events

Each event is sent through `notify()` (Telegram) and over Socket.IO to room `family:<familyId>`. Event names are fixed: don't rename them.

| Event | Fired by | Example Telegram text |
|---|---|---|
| `task.created` | D | New task: Grandpa's eye check, Tue 10am. Who can take it? |
| `task.claimed` | D | Wei Ling will take Grandpa to his eye check. |
| `task.unclaimed` | D | Grandpa's eye check needs someone again. |
| `task.completed` | D | Done: grocery run, by Marcus. |
| `task.cancelled` | D | Cancelled: physio session on Fri. |
| `transit.milestone` | E | Grandpa has arrived at the clinic, with Wei Ling. |
| `log.created` | F | New consultation note for Grandpa. |
| `medication.changed` | C, F | Grandpa's medication was updated. Check the app. |
| `task.updated`, `task.deleted` | D | Socket only. No Telegram message. |

---

## Open decisions

Each has a recommendation. Confirm in the group chat, then delete the line.

1. **Who creates care recipients, C or A?** Recommendation: **C**. C owns the `carerecipients` collection and the form. A only provides the membership check. The "Add recipient" button on Family Home (B) links to C's form.
2. **Can C create tasks?** Recommendation: **no**. C's "Add task" opens D's form with the recipient filled in, so tasks are created in one place only.
3. **Live updates: add to the list, or reload?** Recommendation: **add or replace in place** from socket payloads (see D), with one refetch on reconnect. Reloading the page loses scroll position and form input.
4. **"Translation feature" in B's settings vs F's log translation.** Recommendation: B owns the preference (`preferredLang` via `PATCH /api/users/me`); F owns translating log text. If B also means translating the UI labels, that's vue-i18n on the frontend only and needs no API.
5. **My Tasks overlap between D and E.** D delivers the page layout with static data first; E then connects `GET /api/me/tasks`, tabs, progress and reminders.
6. **Transit step presets.** E proposes the final list. The design doc has `departed`, `arrived`, `consultation_done`, `heading_home`, `home`. The package description uses "fetched Grandpa", "reached hospital" and "going for lunch". Add `custom` either way.
