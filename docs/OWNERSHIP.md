# Feature ownership

Six packages, one owner each. Every person writes the schema, routes and Vue pages for their package. If you need to change something another package owns, ask its owner first.

| Pkg | Owner | Package | Pages | Frontend folders | Backend (models / routes) |
|---|---|---|---|---|---|
| A | Sera | Authentication & Families | Login, Join Family, Select Family, family switcher in the navbar | `auth/`, `components/layout/AppNavigation.vue` (switcher) | `UserModel`, `FamilyModel`, `authMiddleware.js`, `/api/auth`, `/api/families` |
| B | SangYoon | Family Dashboard & Settings | Family Home, Family Settings | `family/`, `settings/` | member and settings routes under `/api/families/:familyId` (on A's `FamilyModel`) |
| C | Jhen | Care Recipient Management | Recipient Hub, Overview, Profile | `recipients/`, `overview/`, `components/layout/RecipientTabs.vue` | `CareRecipientModel`, `/api/families/:familyId/recipients` |
| D | Marcus | Task Management | Open Tasks, Recipient Tasks, Task Detail, My Tasks layout | `tasks/`, layout of `my-tasks/` | `TaskModel`, `/api/families/:familyId/tasks`, Socket.IO live updates |
| E | Chaithra | My Tasks & Transit | My Tasks (tabs, progress, reminders), Transit Mode | `my-tasks/`, `transit/` | `TransitSessionModel`, `/api/me/tasks`, `/api/families/:familyId/tasks/:taskId/transit` |
| F | SeungHak | Care Logs & Integrations | Recipient Log, Calendar, Integrations | `logs/`, `integrations/` (new) | `LogEntryModel`, `NotificationModel`, `/api/families/:familyId/logs`, `utils/notify.js`, Telegram bot |

See [API-CONTRACT.md](API-CONTRACT.md) for the endpoints of each package.

## What each package covers

**A: Authentication & Families (Sera)**
- Sign up, log in, log out.
- Create a family, join a family with an invite code, switch between families.
- Authorisation for the whole app: users can only see data from families they belong to. `requireAuth`, `requireFamilyMember` and `requireFamilyAdmin` in `server/src/middleware/authMiddleware.js` already exist. A owns them from now on.

**B: Family Dashboard & Settings (SangYoon)**
- Family Home: overview of the family's recipients and upcoming tasks.
- Settings: light and dark mode, language and translation preference, member management (view members and their roles).

**C: Care Recipient Management (Jhen)**
- Add and edit care recipients.
- Recipient Hub with four tabs:
  - Overview: next tasks, latest log, things to keep in mind.
  - Tasks: D's Recipient Tasks page, filtered to this recipient. Its "Add task" button opens D's task form with the recipient already filled in.
  - Log: F's Recipient Log page.
  - Profile: the recipient's details.

**D: Task Management (Marcus)**
- Create, edit and delete tasks.
- Claim and unclaim tasks.
- Status flow: open ("available") → claimed → completed.
- Live updates: new or changed tasks show up on screen without a page reload.
- My Tasks page layout. E fills it with data and behaviour.

**E: My Tasks & Transit (Chaithra)**
- My Tasks: Upcoming, In Progress and Completed tabs for your claimed tasks, across all your families.
- Task progress: step-by-step tracking from claim to done.
- Reminders: flag tasks that are due soon.
- Transit for appointment tasks:
  - Post each step of the journey, picking a preset step or typing your own.
  - Every step is saved with the time it was posted.
  - "Safely back home" completes the task automatically.
  - Family members follow the trip as a live timeline.

**F: Care Logs & Integrations (SeungHak)**
- Care logs: notes written after each appointment.
- Log history for a recipient, newest first.
- Calendar of all tasks and appointments.
- Telegram reminders and updates for the family.

## Where packages meet

| Hand-off | From → to | How |
|---|---|---|
| Who can see what | A → everyone | Every family route uses `requireAuth` + `requireFamilyMember`. Never trust a `familyId`, `userId` or role sent by the client. |
| Add task from a recipient | C → D | C links to D's form with the recipient filled in, e.g. `/tasks/new?recipient=<id>`. D owns the form and `POST /tasks`. |
| Recipient Hub tabs | C ↔ D, F | The Tasks tab is D's Recipient Tasks view; the Log tab is F's Recipient Log view. C owns the tab shell. |
| My Tasks page | D → E | D builds the layout first; E adds the tabs, data and reminders. E's endpoint reads D's `tasks` collection. |
| Starting transit | D → E | D's `POST /tasks/:taskId/start` creates the transit session; E owns everything after that. |
| Auto-complete | E → D | E's "home" milestone completes the task through a shared function exported by D's controller, not an HTTP call. |
| Notifications | everyone → F | Call `notify(familyId, eventType, payload)` from `server/src/utils/notify.js`. Never call Telegram directly. |
| Members and settings | B → A | B's member routes change A's `FamilyModel`. Agree on the changes with A first. |

## Shared files

| File | Maintainer |
|---|---|
| `server/src/app.js`, `server/src/index.js`, `server/src/routes/index.js`, `server/src/config/` | Marcus |
| `server/src/constants.js` (all enums and event names) | Marcus; add values by PR |
| `server/src/middleware/authMiddleware.js` | Sera |
| `client/src/router/index.js`, `client/src/components/layout/AppNavigation.vue`, `client/src/services/http.js` | Sera |
| `server/seed.js` | Marcus; post in the group chat before reseeding the shared database |

- Ask the maintainer before you edit a shared file.
- Work on a feature branch and open a PR into `main`. Don't commit to `main` directly.
- If a change affects an endpoint, update [API-CONTRACT.md](API-CONTRACT.md) in the same PR.
