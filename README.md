# CareCircle

**Care together, closer always.**

CareCircle is a family-care coordination application for the IS216 Group Project, Section G8. Families share care tasks, maintain recipient profiles and notes, follow appointment journeys, and recognise the people lending a hand.

Users can belong to multiple families. Recipients, tasks, logs and permissions belong to a family; **My tasks** combines the signed-in user's assignments across families. Desktop and mobile share the same task data and access rules. Dates and times are displayed in Singapore time.

## Project resources

| Resource | Link |
| --- | --- |
| Hosted frontend | [CareCircle on Vercel](https://care-circle-delta-one.vercel.app/) |
| Task allocation and progress | [Team tracker](https://docs.google.com/spreadsheets/d/1q4JjWnC077RomNEm6pJjR2DpeRkb-RZyNa4O9ssRjLk/edit?gid=77767454#gid=77767454) |
| Wireframes | [Figma designs](https://www.figma.com/design/oo8lDXmN1OIF7zJ75SPn3a/Preline-UI-Figma--Community-?node-id=299804-16564&t=bZtps8beujV1iiui-1) |
| Proposal, specifications and database design | [Team document](https://docs.google.com/document/d/1C0RIz2fLhAb1berm-wca4x8c-Li_FNyRMWFHNJV37T8/edit?tab=t.0) |
| Project update presentation | [13 October slides](https://www.canva.com/design/DAHXlRxCktA/P5yOdcJa_RUiOY1k8l6CRQ/edit) |

Custom frontend domain: [carecircle.sumyatmyathtay.com](https://carecircle.sumyatmyathtay.com/). Hosted features depend on the deployed backend and configured providers; a local build does not verify live service availability.

## Local setup

### Requirements and installation

- Node.js 24 and npm. The development environment uses Node 24.
- A reachable MongoDB database. Recurring tasks require Atlas or a replica set for transactions; ordinary tasks can use standalone MongoDB.
- Optional provider credentials for email OTP, AI, translation, transcription, Google Calendar and Telegram.

Run from the repository root:

```sh
git clone https://github.com/SuMyatMyatHtay/CareCircle.git
cd CareCircle
npm install
npm install --prefix client
npm install --prefix server
```

The root, frontend and backend have separate dependencies. The repository also contains pnpm lockfiles; avoid mixing package managers within an existing dependency directory.

### Environment configuration

For a new checkout, copy [server/.env.example](server/.env.example) to `server/.env`. Update existing configuration without overwriting it.

```powershell
# Windows PowerShell
Copy-Item server/.env.example server/.env
```

```sh
# macOS / Linux
cp server/.env.example server/.env
```

Minimum backend settings:

```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/carecircle_local
JWT_SECRET=replace_with_a_long_random_secret
```

Use an Atlas/replica-set URI for recurring tasks. Replace template values with real configuration, or leave unused provider settings blank. Never commit credentials or put backend keys in frontend variables.

Create `client/.env.local`:

```dotenv
VITE_API_URL=/api
```

Set this explicitly: the authentication adapter reads `VITE_API_URL` directly. Vite proxies `/api` to `http://localhost:3000` during development.

### Run

```sh
npm run dev
```

| Address | Purpose |
| --- | --- |
| `http://localhost:5173` | Frontend |
| `http://localhost:3000/api/health` | Express health check |
| `http://localhost:3000/api/health/db` | Database health check |

Alternatively, run `npm run dev:client` and `npm run dev:server` separately. Register an account, create a family, then add recipients and tasks. `/preview/home` offers fictional-data Home and Settings views without signing in; it is not a full application demo.

The optional local `server/seed.js` clears CareCircle collections in the database named by `MONGODB_URI`. It is not required for startup. Inspect its target and coordinate with the team before use; do not reset shared or production data.

## Features

### Accounts and families

- Register, sign in, sign out and edit your profile. Passwords are hashed; JWT sessions use token-version revocation.
- Recover an account through separate email, OTP verification and new-password pages. Resetting revokes existing sessions and requires logging in again.
- Create families, join through a 10-character invite code, switch families and manage invitations/membership. The last admin cannot be removed or demoted.
- Edit profile pictures and account details, view profiles of people sharing your family, and customise an Avatar Studio character. The earlier pet dress-up screen is retained; some characters are Coming soon.
- Choose light, dark or device appearance. Save English, Chinese, Malay or Tamil as your care-note language; the main interface remains English.

### Family Home

- **Needs help soon / Upcoming tasks needing someone:** up to three future, unclaimed tasks ordered by nearest start time. Overdue and assigned tasks are excluded; recurring dates remain grouped.
- **Across the family:** Upcoming, Today, Needs someone, Overdue, Claimed, In progress, Completed and All tasks filters.
- **Recent updates:** family notifications, with local session updates as a fallback.
- Recipient access, task creation, active-trip banners, search and Calendar navigation.

Mobile uses labelled panels rather than a separate Today list. The top bar shows the project logo and the user's avatar. Desktop and mobile share task filters and permissions. Task-card menus allow eligible deletion; Overdue also supports bulk selection.

### Care recipients

Create profiles for elderly care, pregnancy, postpartum care, infants, injuries and other needs. Record pictures, birth dates, mobility, allergies, conditions, diet, medication, emergency contacts, preferred clinics and notes.

The hub has **Overview**, **Tasks**, **Log** and **Profile** tabs. Overview combines upcoming tasks, latest notes and care information; preferred clinics can be mapped.

Link your own account or enable **I'm also a care recipient** in My Profile. Linked records are reused/reactivated rather than duplicated. Infant profiles cannot be linked.

**Remove recipient**, beside Edit profile and on Profile, archives the recipient while preserving tasks, logs and account links. Admins always have access. **Settings > Recipient permissions** chooses admins only (default) or all current family members.

### Tasks and recurring schedules

Create recipient or household tasks with title, notes, category, start/end time, location and optional transport. OneMap helps find Singapore addresses and coordinates. Categories are appointment, therapy, errand, groceries, childcare, medication, companionship and other.

```text
open --claim before start time--> claimed --start--> in_progress --complete--> completed
  ^                                |
  +------------- unclaim ----------+
```

Completing directly from claimed is supported; active tasks can also be cancelled through permitted actions. **Overdue is derived**, not a stored status: an open task becomes overdue when its start time is reached. Atomic claim checks prevent double assignment.

Creators edit tasks from Task detail, including the mobile More menu. Admins and creators can delete open, claimed or cancelled tasks. In-progress/completed tasks cannot be deleted. Assignment alone does not grant editing or deletion rights.

Recurring schedules support daily, weekly, fortnightly, monthly and custom intervals, ending on a date, after a count or with no fixed end.

- Sessions have separate records, claims, journeys and completion histories. Future unclaimed dates stay grouped in the family task board; missed sessions retain their dates in Overdue.
- Claim **Just this date** or **Every upcoming session**. There is no next-four option. A one-date claim assigns only that date; remaining open dates stay grouped from the next available session.
- Whole-series claims cover newly generated sessions. Giving back one date creates an independent exception without transferring the rest of the series.
- Creators edit one date, that date and future sessions, or all upcoming sessions. Started/completed sessions and exceptions are preserved. Moving to a different calendar date requires a one-date edit.
- Admins or the creator stop/resume schedules from the recipient's Tasks tab. Home prioritises upcoming tasks instead of showing schedule management.
- Open-ended schedules generate a rolling four-week window on task reads. Deleted occurrences are recorded to prevent regeneration.
- Recurring writes need MongoDB transactions. Finite schedules support up to 500 sessions; monthly dates absent from a month are skipped.

### My tasks, transit and Calendar

- **My tasks** combines your assignments across families, with filters and start, complete and give-back actions.
- Transport journeys follow departed home, arrived at clinic, consultation done, heading home and safely back home milestones. Safely back home completes the task; companions can manage milestones and end/resume eligible sessions.
- Family members follow position/path updates on OneMap. Sharing requires browser permission and an active transit page; it is not background tracking.
- Starting a trip on a different Singapore calendar day requires confirmation. Confirming moves that session to the current date/time and shifts its end time to preserve duration. Other recurring dates are unchanged; cancelling keeps the schedule.
- Calendar displays family tasks and follow-up appointments from consultation notes, with filtering and task creation.
- Export individual events to Google Calendar, Outlook or `.ics`; optional Google OAuth sync maintains events for assigned tasks.

### Care logs, search and contributions

- Write consultation, medication-change, diet, symptom and general notes. Add consultation notes directly from task/transit screens and link them to the visit.
- Translate through Azure Translator or dictate through Groq transcription. Review dictated text before saving; typed input remains available.
- Search family tasks, logs, people and places.
- Contributions offers weekly, monthly and all-time family leaderboards. A completed task earns one point, plus one for an appointment requiring transport and one for a claim within an hour of creation. Streaks and badges use recorded completions.

### AI assistant

The floating mascot opens Gemini chat to find tasks and propose create, edit, claim, assign, unclaim, start, complete, cancel and delete actions.

- Missing details are gathered before a proposal. Previous locations are suggestions: the model is instructed to ask before reuse; the preview also supports corrections.
- Every write requires confirmation; deletion requires a second confirmation. Proposals expire after 15 minutes. Confirmation rechecks permissions and task state.
- Task deletion is restricted to admins or creators. Recipient settings never grant task-deletion access.
- The assistant explains recipient permissions and directs allowed users to Remove recipient; it cannot archive recipients or change settings through chat.
- Chat clears on account/family changes. Messages stay in browser memory; proposals are stored on the server.

### Telegram and reminders

Add the bot to a group and use `/link <inviteCode>`. `/start`, `/help` and `/unlink` provide help/unlinking. Admins manage preferences, test delivery and unlinking in Settings.

Task, transit and care-log actions generate notifications. Telegram messages omit clinical note bodies and detailed medication changes, although task titles can still contain personal information.

Scheduled reminders need an external scheduler calling `POST /api/cron/reminders` every five minutes with `Authorization: Bearer <CRON_SECRET>`. Depending on preferences, it checks claimed tasks within an hour, unclaimed tasks within 24 hours and a daily summary after 8am Singapore time. Without scheduled calls, reminder sweeps do not run automatically.

## Permissions

The server enforces access, including assistant confirmation. Hidden buttons alone are not access control.

| Action | Permission |
| --- | --- |
| Read family records | Current authenticated family member |
| Create tasks; add/edit recipients | Family member; account-linking restrictions apply |
| Claim | Family member; open task before its start time |
| Give back a claimed task | Creator or assigned person |
| Start/complete | Assigned person, in an allowed task state |
| Edit task | Creator; completed/cancelled tasks are locked; recurring edits have extra safeguards |
| Delete open, claimed or cancelled tasks | Family admin or task creator |
| Delete in-progress/completed tasks | Nobody |
| Bulk-delete overdue tasks | Admins can select any eligible task; members only their own created tasks |
| Stop/resume schedule | Family admin or schedule creator |
| Remove recipient | Admins, or all current members when recipient permissions allow it |
| Change recipient permissions | Family admins |
| Edit/delete care log | Author or family admin |
| Manage other members, invitations and Telegram settings | Family admins, subject to last-admin protection |

Task deletion has no configurable setting. The old overdue-task setting is retired. Recipient removal preserves history through archiving.

Admins can permanently delete a whole family from **Settings > Delete family**, after typing its exact name and acknowledging the warning. This removes all family tasks (including completed tasks), recipients, care logs, trips, recurring schedules, notifications and assistant proposals. Accounts and other families are kept. Deletion requires Atlas or a replica set for transactions. The chatbot directs admins to Settings; it cannot delete families through chat.

## Integration configuration

Core accounts, families, tasks and care profiles do not need optional providers.

| Feature | Backend variables | Additional setup |
| --- | --- | --- |
| Email OTP | `RESEND_API_KEY`, `PASSWORD_RESET_FROM` | Verified sending domain; [setup guide](docs/PASSWORD-RESET.md) |
| AI assistant | `GEMINI_API_KEY`, optional `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Model access for your provider account; fallback defaults to `gemini-3.8-flash` (`off` disables it) |
| Translation | `AZURE_TRANSLATOR_KEY`, `AZURE_TRANSLATOR_REGION` | Matching Translator resource region |
| Voice transcription | `GROQ_API_KEY` | Browser microphone permission; HTTPS or localhost |
| Google Calendar sync | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Calendar API, OAuth consent/test users and exact callback URI |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, optional `TELEGRAM_BOT_USERNAME` | Public HTTPS `/api/integrations/telegram/webhook` with matching secret |
| Scheduled reminders | `CRON_SECRET` | External scheduler calls the reminder endpoint |
| OneMap | No key read by the current implementation | Network access; location permission for live sharing |

For local Google OAuth, use `http://localhost:5173/api/google/callback` in Google configuration and `GOOGLE_REDIRECT_URI`. Vite proxies it to the backend; the callback returns to the frontend origin.

Email recovery uses six-digit codes valid for ten minutes, five verification attempts and a 60-second resend cooldown. Verification issues a single-use reset token valid for five minutes. Real delivery needs a valid sender configuration; a generic request response does not prove email delivery. Check provider logs when troubleshooting.

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | Vue 3, Vue Router, Vite, Bootstrap, Bootstrap Icons, Axios |
| Frontend server state | TanStack Vue Query with family-scoped cache keys |
| API | Node.js ES modules and Express |
| Persistence | MongoDB and Mongoose |
| Authentication | bcryptjs, JWT and token-version revocation |
| Testing | Node test runner, Vitest, Vue Test Utils, jsdom, Playwright and isolated MongoDB |

```text
client/
  public/                Logo, avatar and wardrobe assets
  src/components/        Layout, avatars, cards and dialogs
  src/features/          Auth, family, tasks, recipients, transit, logs, Calendar,
                         search, settings, contributions, assistant and avatar
  src/composables/       Family selection and recipient/task data
  src/services/          HTTP clients and query cache
  src/styles/            Themes and responsive layout
server/
  src/features/          Models, controllers, services and feature routes
  src/middleware/        Authentication and family/role checks
  src/routes/            API registration
  src/config/            Database connection
  src/utils/             Notifications and shared validation
  test/support/          Test database/provider fixtures
shared/                  Recurrence and calendar calculations
scripts/                 Test orchestration and summary reporting
tests/                   Node regressions, API integration, E2E and helpers
docs/                    Contracts, design, feature notes and testing guides
```

Backend `journeys/` implements transit. Stored records include users, families, recipients, tasks, recurring series, transit sessions, logs, notifications, assistant proposals and calendar links.

### API groups

Paths are relative to `/api`. [Route registration](server/src/routes/index.js) is the implementation reference.

| Prefix | Responsibility |
| --- | --- |
| `/auth` | Registration, sessions, profiles, OTP recovery and avatar saving |
| `/families` | Create/join/list families, invitations, members and recipient permissions |
| `/families/:familyId/recipients` | Profiles and archival |
| `/families/:familyId/tasks` | Task CRUD, lifecycle, overdue deletion and recurring schedules |
| `/families/:familyId/tasks/:taskId/transit` | Milestones, location and session control |
| `/families/:familyId/transit` | Family transit sessions |
| `/families/:familyId/logs` | Care logs and translation |
| `/families/:familyId/search` | Family search |
| `/families/:familyId/notifications` | Notification history |
| `/families/:familyId/notify-settings` | Telegram preferences, test delivery and unlinking |
| `/families/:familyId/assistant` | Chat and proposal confirmation/cancellation |
| `/me/tasks` | Your assignments across families |
| `/me/google`, `/google/callback` | Calendar connection, sync and callback |
| `/integrations` | Location search, transcription and Telegram webhook |
| `/cron/reminders` | Secret-protected reminder sweep |

Contributions uses existing task/member data rather than a separate API. Detailed contracts are in [API-CONTRACT.md](docs/API-CONTRACT.md); source routes take precedence over older notes.

## Testing

From the repository root:

```sh
npm test
npm run build
```

| Command | Runs |
| --- | --- |
| `npm test` | Node regressions, support tests and frontend tests |
| `npm run test:regression` | `tests/unit/*.test.mjs`; alias: `test:unit` |
| `npm run test:support` | Infrastructure and isolation guards |
| `npm run test:client` | Frontend Vitest tests |
| `npm run test:api` | API/database integration; alias: `test:integration` |
| `npm run test:e2e` | Desktop/mobile Chromium workflows |
| `npm run test:e2e:headed` | Browser workflows with visible windows |
| `npm run test:all` | All suites, combined reports and terminal summary |
| `npm run test:watch --prefix client` | Frontend watch mode |

Before E2E tests, run `npx playwright install chromium`. API/E2E tests may download MongoDB on first use; recurring tests use a replica set. E2E uses frontend port 5180 and available API/database ports.

The harness creates isolated loopback `carecircle_test_*` databases, does not load `server/.env`, and does not run the shared seed script. Providers are disabled or doubled where appropriate. Reports/screenshots use ignored runtime directories; `test:all` prints its combined-report path and fails if a suite fails or a report is missing.

Mocked-provider tests do not prove live email, OAuth, Telegram or deployment configuration. Use fresh command output for test totals.

Guides: [testing](docs/TESTING.md), [recurring tests](docs/TESTING-RECURRING.md), [browser tests](tests/e2e/README.md), [Part E testing](docs/TESTING-PART-E.md), and [Korean walkthrough](docs/TESTING-EXPLAINED.ko.md).

## Deployment

1. Deploy the Express API with backend environment variables and reachable MongoDB. Recurrence needs Atlas or a replica set.
2. Run `npm run build --prefix client`; publish `client/dist`. Set `VITE_API_URL` at build time.
3. Check [client/vercel.json](client/vercel.json): `/api` currently rewrites to `https://carecircle-api.vercel.app/api/`. Update it if the API host changes. Other routes fall back to `index.html` for Vue Router.
4. Configure the production Google callback, Telegram webhook, Resend domain and external reminder scheduler as needed.
5. Verify login, database connectivity and enabled provider flows in the deployed environment.

The backend listens on `PORT` outside Vercel and exports the Express app for serverless use. Recording and location sharing need HTTPS outside localhost.

## Operational limits

- Lists, notifications and transit use polling rather than WebSockets. Live location requires the companion's active page and browser permission.
- Open-ended recurrence extends on task reads; it has no separate background generator.
- Reminder timing depends on the scheduler and preferences. Atomic reminder flags prevent duplicate claims, not provider-delivery failures.
- Gemini replies depend on provider availability and quota. Model instructions guide location suggestions; server validation and confirmation protect writes. Family context and conversation text are sent to Gemini. The assistant does not provide medical advice.
- Assistant/IP limits include per-process state; multi-instance deployments need shared gateway controls for consistent aggregate limits.
- Translation, transcription, email and calendar features require provider configuration. Installing dependencies alone does not establish it.
- Family names are set at creation. Custom relationship labels, yearly contribution wraps and Coming soon avatar characters are not implemented.

## Team contributions

The table records the team's contributions beyond the initial work allocation. A–F identifies each member's original package; implemented work extends across those boundaries. [docs/OWNERSHIP.md](docs/OWNERSHIP.md) describes the original allocation, while the [team tracker](https://docs.google.com/spreadsheets/d/1q4JjWnC077RomNEm6pJjR2DpeRkb-RZyNa4O9ssRjLk/edit?gid=77767454#gid=77767454) tracks assignments and progress.

| Initial package | Team member | Contributions |
| --- | --- | --- |
| A | Sera | Authentication, families, invitation joining and family access; avatar customisation and the dress-up game; Gemini AI chatbot; task claiming and unclaiming workflows, including double-claim prevention and overdue-claim restrictions |
| B | SangYoon | Family dashboard and settings pages |
| C | Jhen | Care recipient management, profiles and recipient hub; language translation; Telegram chatbot implementation |
| D | Marcus | Task creation and management, task lifecycle foundations and shared backend foundations |
| E | Chaithra | My tasks, transit, maps and calendar workflows |
| F | SeungHak | Care logs, consultation notes from tasks, the family Calendar, Groq speech-to-text, automatic note translation and care-note/task update notifications |

The Contributions leaderboard and other cross-feature improvements are documented in the feature sections without additional individual attribution.

## Contributing

Use a feature branch and describe behavior changes and validation in your pull request. Keep implementation in its feature folders, coordinate shared schema/API changes, and update affected documentation. Check desktop/mobile layouts and loading, empty, success and failure states. Never reset a shared database without coordinating with the team.

Further references: [database design](docs/DATABASE-DESIGN.md), [ownership](docs/OWNERSHIP.md), [family UI](docs/FAMILY-UI.md), [assistant](docs/ASSISTANT.md), and [password recovery](docs/PASSWORD-RESET.md). Some feature notes describe earlier plans; current source code is authoritative.
