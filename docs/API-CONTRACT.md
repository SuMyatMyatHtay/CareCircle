# CareCircle API contract

All endpoints, by package. **Implemented** means the endpoint is merged and tested; **Planned** means it is agreed but not built. If you change an endpoint, update this file in the same PR. Owners are listed in [OWNERSHIP.md](OWNERSHIP.md).

| Pkg | Owner | Base path | Status |
|---|---|---|---|
| A | Sera | `/api/auth`, `/api/families` | Planned (middleware and models done) |
| B | SangYoon | `/api/families/:familyId` (members, settings), `/api/users/me` | Planned |
| C | Jhen | `/api/families/:familyId/recipients` | Planned |
| D | Marcus | `/api/families/:familyId/tasks` | Planned (model and routes done; controller stubs return 501) |
| E | Chaithra | `/api/me/tasks`, `/api/families/:familyId/tasks/:taskId/transit` | Planned |
| F | SeungHak | `/api/families/:familyId/logs`, `/api/families/:familyId/notifications`, `/api/integrations` | Logs implemented; notifications and integrations planned |

Only the tasks router is mounted so far. Any other path returns `404` until its package adds a router to `server/src/routes/index.js`, at the path listed in this file.

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
- **Seed users:** `alex@`, `jasmine@`, `may@` and `mia@carecircle.test`, password `password123`. Family invite code: `TAN123`.

---

## B: Family Dashboard & Settings (SangYoon)

| Method | Path | Who | Body | Response | Status |
|---|---|---|---|---|---|
| GET | `/api/families/:familyId/members` | member | none | `{ members: [{ user: { _id, name, email, telegramUsername }, role, relationship, joinedAt }] }` | Planned |
| PATCH | `/api/families/:familyId/members/:userId` | admin | `{ role?, relationship? }` | `{ member }`. `409` if it would remove the last admin. | Planned |
| DELETE | `/api/families/:familyId/members/:userId` | admin, or the user themself (leaving) | none | `204`. `409` if it would remove the last admin. | Planned |
| PATCH | `/api/families/:familyId` | admin | `{ name }` | `{ family }` | Planned |
| POST | `/api/families/:familyId/invite-code` | admin | none | `{ inviteCode }` (a new code; the old one stops working) | Planned |
| PATCH | `/api/users/me` | logged in | `{ name?, phone?, preferredLang?, telegramUsername? }` | `{ user }` | Planned |

- **Dashboard:** Family Home doesn't need its own endpoint. It combines C's `GET /recipients` with D's `GET /tasks?from=<now>&to=<+7 days>&status=open,claimed,in_progress`.
- **Light and dark mode:** handled in the browser only, saved in `localStorage`. No API.
- **`preferredLang`:** a LibreTranslate language code, e.g. `en` or `zh`. F's logs use it to decide which translation to show.

---

## C: Care Recipient Management (Jhen)

Base: `/api/families/:familyId/recipients`

| Method | Path | Who | Body | Response | Status |
|---|---|---|---|---|---|
| GET | `/` | member | Query: `includeArchived=true` (optional) | `{ recipients }`. Active only by default. | Planned |
| POST | `/` | member | `{ name, nickname?, careType, dateOfBirth?, mobility?, allergies?, conditions?, dietaryRestrictions?, medications?, emergencyContacts?, preferredClinic?, careNotes? }` | `201 { recipient }` | Planned |
| GET | `/:recipientId` | member | none | `{ recipient }` | Planned |
| PATCH | `/:recipientId` | member | any of the fields above | `{ recipient }`. If `medications` changed, call `notify(..., 'medication.changed')`. | Planned |
| POST | `/:recipientId/archive` | admin | none | `{ recipient }` with `isActive: false`. Recipients are archived, never deleted. | Planned |

- **Model:** `server/src/models/CareRecipientModel.js` already matches the design doc. C owns it from now on.
- **Overview tab:** combines D's `GET /tasks?recipient=<id>&from=<now>`, F's `GET /logs?recipient=<id>&limit=1`, and this profile.
- **Tasks tab:** "Add task" goes to D's form with the recipient filled in. C doesn't need a task endpoint.

---

## D: Task Management (Marcus)

Base: `/api/families/:familyId/tasks`. **Planned.**
- **Done:** the routes are mounted in `server/src/routes/taskRoute.js`, and `server/src/models/TaskModel.js` is ready.
- **Still to do:** every handler in `server/src/controllers/taskController.js` currently returns `501`. The table below describes the intended behaviour.

| Method | Path | Who | Body / query | Response |
|---|---|---|---|---|
| GET | `/` | member | Query (all optional): `status=open,claimed`, `recipient=<id>` or `none` (household tasks), `claimedBy=me` or `<userId>`, `from=<date>`, `to=<date>` (on `startAt`) | `{ tasks }`, sorted by `startAt` |
| GET | `/:taskId` | member | none | `{ task }` |
| POST | `/` | member | `{ title, startAt, endAt?, description?, category?, recipient?, location?, needsTransit? }` | `201 { task }`, always `open`. Sends `task.created`. |
| PATCH | `/:taskId` | creator or admin | any subset of the fields above | `{ task }`. `status` and `claimedBy` are ignored. `409` once a task is completed or cancelled. |
| DELETE | `/:taskId` | creator or admin | none | `{ message, taskId }`. `409` for `in_progress` and `completed` tasks; cancel those instead. |
| POST | `/:taskId/claim` | member | none | open → claimed. `409 { error: 'Task already claimed' }` if someone got there first. Sends `task.claimed`. |
| POST | `/:taskId/unclaim` | claimer or admin | none | claimed → open. Sends `task.unclaimed`. |
| POST | `/:taskId/start` | claimer | none | claimed → in_progress, `{ task, transitSession }`. A transit session is created only when `needsTransit` is true. |
| POST | `/:taskId/complete` | claimer | none | claimed or in_progress → completed. Ends any transit session. Sends `task.completed`. |
| POST | `/:taskId/cancel` | creator or admin | none | open, claimed or in_progress → cancelled. Ends any transit session. Sends `task.cancelled`. |

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
| GET | `/api/me/tasks` | logged in | `status=claimed,in_progress,completed`, `from`, `to` (all optional) | `{ tasks }` (task shape above, plus `family: { _id, name }`) | Planned |

- **Scope:** only `requireAuth` (no `familyId`). Filter on `claimedBy = req.user._id` and on `family` being one of the user's families, so a user who left a family stops seeing its tasks.
- **Tabs:** Upcoming = `claimed`, In Progress = `in_progress`, Completed = `completed`.
- **"Due soon" flag:** the client works it out, e.g. `startAt` within the next 24 hours. F's Telegram reminders handle the push side.
- **Tasks collection:** belongs to D, so get D's review on queries against it.

### Transit

Base: `/api/families/:familyId/tasks/:taskId/transit`. Mount this before D's tasks router in `routes/index.js`.

| Method | Path | Who | Body | Response | Status |
|---|---|---|---|---|---|
| GET | `/api/families/:familyId/transit?status=active` | member | none | `{ transitSessions }` with task and companion populated, for the live banner on Home | Planned |
| GET | `/` | member | none | `{ transitSession }`; `404` if the task has no session | Planned |
| POST | `/milestones` | companion | `{ type, label }` | `201 { transitSession }`. The server sets `at`. Sends `transit.milestone`. | Planned |
| PATCH | `/location` | companion | `{ lat, lng }` | `{ transitSession }` (stretch goal) | Planned |

- **Starting a session:** D's `POST /tasks/:taskId/start` creates it. E never creates one directly.
- **Preset vs custom steps:** preset steps send a fixed `type` and its default `label`. Custom steps send `type: 'custom'` and the text the user typed as `label`. **Schema change needed:** add `custom` to `MILESTONE_TYPES` in `constants.js`, and agree on the final list of presets.
- **Auto-complete:** a `home` ("safely back home") milestone ends the session and completes the task. Call D's shared completion function, not the HTTP endpoint, so the status rules stay in one place.
- **Live timeline:** emit `transit.milestone` with `{ transitSession }` to room `family:<familyId>`.
- **Model:** `server/src/models/TransitSessionModel.js` is already done. E owns it from now on.

---

## F: Care Logs & Integrations (SeungHak)

### Care logs

Base: `/api/families/:familyId/logs`

| Method | Path | Who | Body / query | Response | Status |
|---|---|---|---|---|---|
| GET | `/` | member | Query: `recipient=<id>`, `before=<date>`, `limit` (1–50, default 20) | `{ logs }`, newest first, `author` populated | Implemented |
| POST | `/` | member | `{ recipient, type, content, task?, consultation?, medicationChanges?, inputMethod?, originalLang? }` | `201 { log }`. `author` is the logged-in user. `consultation` is kept only when `type` is `consultation`. Will send `log.created`, plus `medication.changed` if `medicationChanges` is set, once `notify()` exists. | Implemented |
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

1. **Who creates care recipients, C or A?** Recommendation: **C**. C owns the `careRecipients` collection and the form. A only provides the membership check. The "Add recipient" button on Family Home (B) links to C's form.
2. **Can C create tasks?** Recommendation: **no**. C's "Add task" opens D's form with the recipient filled in, so tasks are created in one place only.
3. **Live updates: add to the list, or reload?** Recommendation: **add or replace in place** from socket payloads (see D), with one refetch on reconnect. Reloading the page loses scroll position and form input.
4. **"Translation feature" in B's settings vs F's log translation.** Recommendation: B owns the preference (`preferredLang` via `PATCH /api/users/me`); F owns translating log text. If B also means translating the UI labels, that's vue-i18n on the frontend only and needs no API.
5. **My Tasks overlap between D and E.** D delivers the page layout with static data first; E then connects `GET /api/me/tasks`, tabs, progress and reminders.
6. **Transit step presets.** E proposes the final list. The design doc has `departed`, `arrived`, `consultation_done`, `heading_home`, `home`. The package description uses "fetched Grandpa", "reached hospital" and "going for lunch". Add `custom` either way.
