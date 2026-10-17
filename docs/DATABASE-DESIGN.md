# CareCircle database design

Oct 16, 2026 · @cures

## Overview and conventions

CareCircle uses MongoDB with Mongoose: 7 collections, all scoped to a family. The gratitude log is on hold, so it has no collection for now. Every document except `users` carries a `family` reference, and every query filters on it. That one rule is what stops one family from seeing another's data.

- **Tenancy:** routes look like `/api/families/:familyId/...`. `requireAuth` (`server/src/middleware/requireAuth.js`) sets `req.user.userId` from the JWT. `requireFamilyMember` (`server/src/middleware/requireFamilyMember.js`) loads the family, checks that the user is in `members`, and attaches `req.family` and `req.memberRole`. `requireFamilyAdmin` lives in the same file.
- **Naming:** models are singular PascalCase (`CareRecipient`). Collection names are all lowercase, as Mongoose generates them: `users`, `families`, `carerecipients`, `tasks`, `logentries`, `transitsessions`, `notifications`. `server/seed.js` writes to the same names. Fields are camelCase. References are named after the thing (`recipient`, `claimedBy`), not `recipientId`.
- **Timestamps:** every schema uses `{ timestamps: true }` for `createdAt` and `updatedAt`. Store dates in UTC; convert to Singapore time only in the Vue layer.
- **Enums:** all enum values live in one shared `server/src/constants.js` file and are imported by both schemas and validators. No magic strings in route handlers.
- **Embed vs reference:** embed when the child is small, bounded and always read with its parent (family members, medications, transit milestones). Reference when it grows without limit or is queried on its own (tasks, log entries).
- **Locations:** any place picked through OneMap is stored as the same sub-document: `{ name, address, postal, lat, lng }`. Each model that needs it defines a `locationSchema` with that shape (`_id: false`, `postal` is 6 digits or empty).
- **Database access:** every query lives in the model as a static, under a `// ---------- Database operations ----------` section. Controllers only call those statics.

## Entity relationship diagram

Families sit at the centre: users join them, and recipients, tasks and notifications belong to them. Users and families are many-to-many, resolved through `FAMILY_MEMBERS`. In MongoDB that is the embedded `members` array on each family, not a separate collection. A care recipient can also point back to one user through `linkedUser` (zero or one; at most one recipient per user per family).

_(Entity relationship diagram: see the shared doc.)_

Read each line from both ends. For example, `tasks` to `transitsessions` is one-to-zero-or-one: a task has at most one transit session, and every session belongs to exactly one task. Fields marked FK→users reference `users`, but those lines are left off the diagram to keep it readable.

## Sample data

Running `node seed.js` in `server/` fills the `carecircle` database with one family, the Tans. Every account's password is `password123`.

| Login email | Name | Role | Relationship | Language |
| --- | --- | --- | --- | --- |
| alex@carecircle.test | Alex Tan | admin | Grandson | English |
| jasmine@carecircle.test | Jasmine Tan | admin | Granddaughter | English |
| may@carecircle.test | Aunt May | member | Daughter | Chinese (`zh`) |
| mia@carecircle.test | Mia Tan | member | Granddaughter | English |

- **Invite code:** `7925C4A333`. Use it to test the join-family flow with a new account.
- **Dates move with the run.** Task dates are calculated from the day the script runs, so "today" always has 3 tasks: the eye check-up, the formula run and the evening walk.
- **Resetting wipes everyone's test data.** The whole team shares one database, so tell the group chat before running the seed again.
- **The Telegram chat ID is a placeholder.** It gets replaced when the bot receives `/link 7925C4A333` in the real group.
- **No seeded recipient has `linkedUser`.** The schema default reads it as `null`, and the unique index ignores it, so no migration is needed. The seed doesn't create the `{ family, linkedUser }` index; Mongoose builds it when the server starts.

_(Sample data diagram: see the shared doc.)_

Each task line shows its status, who claimed it and its day. The eye check-up is the one task in transit, so it drives the Home banner and transit mode.

### Care recipients

| Nickname | Care type | Mobility | Allergies | Medications | Preferred clinic |
| --- | --- | --- | --- | --- | --- |
| Grandpa (Tan Ah Kow) | elderly | assisted, walking stick | Penicillin (severe) | Metformin 500mg, eye drops | Ang Mo Kio Polyclinic |
| Grandma (Lim Siew Lan) | elderly | independent | Shellfish (mild) | Amlodipine 10mg | Ang Mo Kio Polyclinic |
| Baby Emma (Emma Tan) | infant | always supervised | none | none | KK Women's and Children's Hospital |

### Tasks (11)

Days are relative to the day the seed runs: 0 = today, -1 = yesterday.

| Day | Task | For | Status | Claimed by | Needs transit |
| --- | --- | --- | --- | --- | --- |
| -6 | Polyclinic consultation | Grandpa | completed | Aunt May | yes |
| -1 | Weekly grocery run | household | completed | Alex | no |
| 0, 10:00 | Eye check-up | Grandpa | in\_progress | Jasmine | yes |
| 0, 2:00pm | Buy formula and diapers | Baby Emma | open | — | no |
| 0, 6:00pm | Evening walk | Grandma | claimed | Aunt May | no |
| +1 | Physio session | Grandma | open | — | yes |
| +2 | Pick up medication refill | Grandpa | claimed | Alex | no |
| +2 | Babysit Emma | Baby Emma | claimed | Mia | no |
| +3 | Dental cleaning | Grandma | cancelled | — | no |
| +6 | Diabetes review | Grandpa | open | — | yes |
| +12 | Vaccination appointment | Baby Emma | claimed | Jasmine | yes |

### Log entries (5)

| Day | For | Type | Author | Worth testing |
| --- | --- | --- | --- | --- |
| -6 | Grandpa | consultation | Aunt May | Has a cached Chinese translation and a next-appointment date |
| -2 | Grandpa | symptom | Jasmine | Entered by voice (`inputMethod: voice`) |
| -1 | Grandma | medication\_change | Aunt May | Amlodipine 5mg to 10mg |
| -1 | Baby Emma | general | Jasmine | Plain note |
| -1 | Grandpa | diet | Alex | Linked to the grocery run task |

### Transit sessions (2) and notifications (7)

- **Eye check-up, active:** Jasmine with Grandpa, 2 of 5 milestones done (departed, arrived at clinic). Use it to build the Home banner and the next-milestone button.
- **Polyclinic consultation, ended:** Aunt May with Grandpa, all 5 milestones done.
- **Notifications:** 7 Telegram messages marked `sent`: task created, claimed, completed and cancelled, two transit milestones, and a medication change.

## Collection schemas

Fields marked required must be enforced in the Mongoose schema, not only on the frontend. `_id`, `createdAt` and `updatedAt` are left out of every table below.

### users

| Field | Type | Notes |
| --- | --- | --- |
| name | String | required |
| email | String | required, unique, lowercase, trimmed |
| passwordHash | String | required, bcrypt; never returned by the API (`select: false`) |
| phone | String | optional |
| preferredLang | String | default `en`; LibreTranslate language code |
| telegramUsername | String | optional, for @mentions in group messages |

Indexes: `{ email: 1 }` unique.

### families

| Field | Type | Notes |
| --- | --- | --- |
| name | String | required, e.g. "Tan family" |
| inviteCode | String | required, unique, 10 uppercase hex characters (`randomBytes(5)`), regenerable by an admin |
| createdBy | ObjectId → User | required |
| members | \[ { userId, role, relationship, joinedAt } \] | embedded; `role` enum `admin` / `member`; `relationship` free text, e.g. "Son" (not in Family.model.js yet) |
| telegram | { chatId, linkedBy, linkedAt } | set when the bot receives `/link <inviteCode>` in a group |
| notifyOn | \[String\] | event types sent to Telegram; defaults to all |

Indexes: `{ inviteCode: 1 }` unique, `{ 'members.userId': 1 }` to find a user's families.

### carerecipients

Model `CareRecipient` in `server/src/features/recipients/CareRecipient.model.js`. Owned by package C.

| Field | Type | Notes |
| --- | --- | --- |
| family | ObjectId → Family | required; always taken from the URL, never the body |
| name | String | required, max 100 |
| nickname | String | default `''`; what the family calls them, e.g. "Grandpa"; shown in the UI |
| careType | String enum | required; `elderly` / `pregnancy` / `postpartum` / `infant` / `injury` / `other` |
| dateOfBirth | Date | default null; can't be in the future |
| mobility | { level, notes } | default null; `level` enum `independent` / `assisted` / `wheelchair` / `bedbound` |
| allergies | \[ { name, severity } \] | embedded, `_id: false`; `name` required; `severity` enum `mild` / `severe`, default `mild` |
| conditions | \[String\] | e.g. "Type 2 diabetes" |
| dietaryRestrictions | \[String\] | e.g. "Low sodium" |
| medications | \[ { name, dosage, frequency, startDate, notes, updatedBy, updatedAt } \] | embedded, `_id: false`; `name` required; current list only (history lives in `logentries`). `updatedBy` and `updatedAt` are set by the server, never the client |
| emergencyContacts | \[ { name, relationship, phone } \] | embedded, `_id: false`; `name` and `phone` required |
| preferredClinic | locationSchema | default null; from OneMap search |
| careNotes | String | max 2000; free text: routines, preferences, what calms them |
| isActive | Boolean | default `true`; archive instead of delete |
| linkedUser | ObjectId → User | default null; set when the recipient also has a CareCircle account (e.g. a pregnant or injured member). Must be a member of the same family |

Indexes: `{ family: 1, isActive: 1 }`; `{ family: 1, linkedUser: 1 }` unique with `partialFilterExpression: { linkedUser: { $type: 'objectId' } }`, so many recipients can be unlinked but one account links to at most one recipient per family.

#### Recipients backend (package C): implemented

Files: `server/src/features/recipients/CareRecipient.model.js`, `controller.js`, `routes.js`. The router is mounted at `/api/families/:familyId/recipients` behind `requireAuth` and `requireFamilyMember`. Full request and response shapes are in `docs/API-CONTRACT.md`, section C.

| Method | Path | Who | Behaviour |
| --- | --- | --- | --- |
| GET | `/` | member | `{ recipients }`, sorted by name; active only unless `includeArchived=true` |
| POST | `/` | member | `201 { recipient }`; `name` and `careType` required; `isActive` always `true` |
| GET | `/:recipientId` | member | `{ recipient }` |
| PATCH | `/:recipientId` | member | `{ recipient }`; any field except `family` and `isActive`; empty body is `400 Nothing to update` |
| POST | `/:recipientId/archive` | admin (`requireFamilyAdmin`) | `{ recipient }` with `isActive: false` and `linkedUser` cleared (an archived recipient would otherwise block that account forever); archiving twice is harmless. There is no DELETE |

Rules the implementation follows:

- **Model statics:** `getRecipientsByFamily`, `getRecipientInFamily`, `getPopulatedRecipientById`, `createRecipient`, `updateRecipient` (`runValidators: true`), `archiveRecipient`. `linkedUser` is populated with `name telegramUsername`.
- **linkedUser:** optional on POST and PATCH; `null` or `''` unlinks, and any member can unlink. A new link must be the logged-in user's own id (`403` otherwise): only the person being cared for links themselves. Re-sending the stored link is allowed, since the edit form sends every field. Infant recipients can never be linked; the check runs on the result of the update, so turning a linked recipient into an infant is a `400` too. Any value that isn't the id of a current member of `req.family` is a `400` (`Linked user must be a member of this family`). A second recipient linked to the same account hits the unique index (error code `11000`) and returns `409`.
- **Medications:** entries identical to a stored one keep their `updatedBy`/`updatedAt`; new or edited entries get the current user and time. If the list changed, the controller announces `medication.changed` through a no-op `announce()` placeholder until package F's `notify()` exists.
- **Errors:** `{ error, errors? }`, matching tasks and logs. `400` validation, `403` not an admin, `404` for a recipient outside this family or a malformed id, `409` duplicate link.
- **Other packages depend on it:** tasks and logs look up `mongoose.models.CareRecipient` by name and populate `name nickname careType`. Now that the model is registered, `Task.recipientInFamily` and the logs controller reject a recipient from another family. Keep the model name and those three field names.

### tasks

| Field | Type | Notes |
| --- | --- | --- |
| family | ObjectId → Family | required |
| recipient | ObjectId → CareRecipient | optional; empty for household chores |
| title | String | required |
| description | String | optional |
| category | String enum | `appointment` / `therapy` / `errand` / `groceries` / `childcare` / `medication` / `companionship` / `other` |
| startAt, endAt | Date | `startAt` required |
| location | locationSchema | optional |
| needsTransit | Boolean | default `false`; shows the Start transit button |
| status | String enum | `open` / `claimed` / `in_progress` / `completed` / `cancelled`; default `open` |
| createdBy | ObjectId → User | required |
| claimedBy | ObjectId → User | null while open |
| claimedAt, completedAt | Date | set by the status transitions |

Indexes: `{ family: 1, startAt: 1 }` for the board, `{ family: 1, status: 1 }` for open tasks, `{ claimedBy: 1, startAt: 1 }` for My tasks, `{ recipient: 1, startAt: 1 }` for the care hub.

### logentries

| Field | Type | Notes |
| --- | --- | --- |
| family | ObjectId → Family | required |
| recipient | ObjectId → CareRecipient | required |
| task | ObjectId → Task | optional; set when written from a task, e.g. after an appointment |
| author | ObjectId → User | required |
| type | String enum | `consultation` / `medication_change` / `diet` / `symptom` / `general` |
| content | String | required |
| originalLang | String | language it was written in |
| translations | Map of String | cache, key = language code; filled on first request so each text is translated once |
| consultation | { doctorName, clinic, nextAppointment } | optional, only for `consultation` |
| medicationChanges | \[ { name, change, details } \] | `change` enum `added` / `stopped` / `dosage_changed` |
| inputMethod | String enum | `text` / `voice` |

Indexes: `{ recipient: 1, createdAt: -1 }` for the hub, `{ family: 1, createdAt: -1 }` for the Activity feed.

### transitsessions

| Field | Type | Notes |
| --- | --- | --- |
| family | ObjectId → Family | required |
| task | ObjectId → Task | required, unique: one session per task |
| companion | ObjectId → User | required; must equal the task's `claimedBy` |
| status | String enum | `active` / `ended` |
| milestones | \[ { type, label, at, lat, lng } \] | embedded; `type` enum `departed` / `arrived` / `consultation_done` / `heading_home` / `home` |
| lastLocation | { lat, lng, at } | optional, overwritten on each ping; stretch goal |
| startedAt, endedAt | Date |  |

Indexes: `{ task: 1 }` unique, `{ family: 1, status: 1 }` for the live banner on Home.

### notifications

An outbox for Telegram. Other modules never call the Telegram API directly; they call `notify(familyId, eventType, payload)`, which writes here and sends.

| Field | Type | Notes |
| --- | --- | --- |
| family | ObjectId → Family | required |
| eventType | String enum | see Cross-module events |
| refType, refId | String, ObjectId | what the event is about, used to build the deep link |
| text | String | the message as sent |
| status | String enum | `pending` / `sent` / `failed` / `skipped` (no chat linked, or event muted) |
| error | String | Telegram error, if failed |
| sentAt | Date |  |

Indexes: `{ family: 1, createdAt: -1 }`, `{ status: 1 }` for retries.

## Task lifecycle and the claim query

A task moves `open → claimed → in_progress → completed`, and only through these transitions. Each one is its own endpoint, so status is never set by a generic `PATCH`.

| Transition | Endpoint | Who can do it | Side effects |
| --- | --- | --- | --- |
| open → claimed | `POST /tasks/:id/claim` | any member | sets `claimedBy`, `claimedAt`; notify `task.claimed` |
| claimed → open | `POST /tasks/:id/unclaim` | the claimer or an admin | clears `claimedBy`; notify `task.unclaimed` |
| claimed → in\_progress | `POST /tasks/:id/start` | the claimer | if `needsTransit`, creates the `transitSession` |
| claimed or in\_progress → completed | `POST /tasks/:id/complete` | the claimer | sets `completedAt`; ends any transit session; notify `task.completed` |
| any → cancelled | `POST /tasks/:id/cancel` | the creator or an admin | notify `task.cancelled` |

The claim must be one atomic update. Two people tapping Claim at the same moment then can't both win:

```javascript
const task = await Task.findOneAndUpdate(
  { _id: req.params.id, family: req.family._id, status: 'open' },
  { status: 'claimed', claimedBy: req.user.userId, claimedAt: new Date() },
  { new: true }
);
if (!task) return res.status(409).json({ error: 'Task already claimed' });
```

The same pattern (status in the filter, new status in the update) applies to every transition in the table. A `409` tells the frontend to refresh the card and show who got there first.

## Access rules and cross-module events

Any family member can read everything in their family; writes are limited as below. Keep the role model to two roles, `admin` and `member`. That is enough for the demo and keeps the middleware simple.

| Action | Member | Admin |
| --- | --- | --- |
| Read anything in the family | yes | yes |
| Create tasks and log entries | yes | yes |
| Edit or delete a log entry | own only | any |
| Create or edit a care profile | yes | yes |
| Archive a care recipient | no | yes |
| Cancel a task | own only | any |
| Manage members, invite code, Telegram link | no | yes |

Events are the only way modules talk to each other. A module calls `notify()` and emits the same event name over Socket.IO to the room `family:<familyId>`. Agree on these names in week 1 and don't rename them later.

| Event | Fired by | Telegram message (example) |
| --- | --- | --- |
| `task.created` | Tasks | New task: Grandpa's eye check, Tue 10am. Who can take it? |
| `task.claimed` | Tasks | Wei Ling will take Grandpa to his eye check. |
| `task.unclaimed` | Tasks | Grandpa's eye check needs someone again. |
| `task.completed` | Tasks | Done: grocery run, by Marcus. |
| `task.cancelled` | Tasks | Cancelled: physio session on Fri. |
| `transit.milestone` | Transit | Grandpa has arrived at the clinic, with Wei Ling. |
| `log.created` | Logs | New consultation note for Grandpa. |
| `medication.changed` | Logs and care profiles | Grandpa's medication was updated. Check the app. |

Every Telegram message ends with a deep link to the related page, built from `refType` and `refId`. Keep health details out of the Telegram text itself (say "medication was updated", not the drug and dose), since group chats get forwarded.

## Ownership and week-one checklist

Each person owns the schema, routes and Vue pages for their slice. Anyone who needs to change a schema they don't own asks its owner first.

| Person | Slice | Owns collections | Reads from |
| --- | --- | --- | --- |
| 1 | Auth, families, app shell | users, families | — |
| 2 | Task board, Google Calendar | tasks | carerecipients, users |
| 3 | Care profiles, care hub page | carerecipients | tasks, logentries |
| 4 | Companion log, translation, voice input | logentries | carerecipients, tasks |
| 5 | Transit mode, OneMap | transitsessions | tasks |
| 6 | Telegram bot, notifications | notifications; the `telegram` field on families | families, tasks |

Week-one checklist, before feature work starts:

- [ ] Person 1 pushes the repo skeleton: `server/models`, `server/routes`, `server/middleware`, `server/constants.js`, Vue app with router and Bootstrap theme
- [ ] Person 1 writes `requireAuth` (JWT) and `requireFamilyMember` middleware
- [ ] Each person writes their Mongoose model from this doc and opens a PR
- [ ] Person 6 ships a stub `notify(familyId, eventType, payload)` that only logs, so others can call it from day one
- [ ] Person 1 writes a seed script: one family, 4 users, 3 recipients (an elderly parent, a postpartum mother, an infant), 10 tasks across all statuses
- [ ] Everyone shares one MongoDB Atlas cluster with a separate database per developer (`carecircle_<name>`) so seed data doesn't clash
