# CareCircle — navigable mock-data handoff

This is a **navigable UI prototype**, not a completed application. All data in `client/src/data/mock.js` is fictional, static, and read-only. No authentication, database CRUD, notifications, or medical functionality is implemented. Do not claim the buttons marked coming soon are functional.

## Run

```bash
npm install
npm install --prefix client
npm install --prefix server
cp server/.env.example server/.env  # Windows PowerShell: Copy-Item server/.env.example server/.env
npm run dev
```

UI: http://localhost:5173 · API: http://localhost:3000. Set a local MongoDB connection in `.env` when backend work begins; mock UI can be browsed without MongoDB.

## The real navigation flow
`/login` → `/family` → `/recipients/grandpa` → Overview/Tasks/Log/Profile → Task Detail → Transit Mode. Global routes `/my-tasks` and `/family/settings`. Navigation buttons/links work; data is not editable.

## Responsibility split (3 reliable, 3 may be unavailable)
- **Marcus (core):** authentication, family home, family access control, MongoDB connection and backend integration. Own `auth/`, `family/`, `server/src/features/auth`, `server/src/features/families`.
- **Sera (core):** recipient task board, task detail, task CRUD/claiming and transit statuses. Own `tasks/`, `transit/`, corresponding backend modules.
- **Chaithra (core):** recipient hub, profile, overview, care logs. Own `recipients/`, `overview/`, `logs/`, corresponding backend modules.
- **Member 4 (independent):** My Tasks global page and its dynamic filtering; coordinate task schema with Sera.
- **Member 5 (independent):** Family Settings and member/invitation management; coordinate family schema with Marcus.
- **Member 6 (optional):** external OneMap or Telegram integration, gratitude and accessibility enhancements; non-blocking.

## Important team agreement
Data shapes in `client/src/data/mock.js` are **only a prototype contract**; freeze/discuss backend schema before coding. Prefer separate feature branches and PRs into protected `main`. All six teammates should contribute code.

## Next depth per page
- Login: register/sign-in/logout, role checks and family invite validation.
- Family Home: switch circles, create recipients, aggregate due tasks.
- My Tasks: filter/sort personal assigned tasks and calendar view.
- Family Settings: invitations, member roles, removal and audit.
- Recipient Hub: navigation, care snapshot and recipient creation.
- Overview: upcoming deadlines, alerts and recent updates.
- Tasks: task CRUD, claim/unclaim, status change, date filtering and validations.
- Detail: task edit, assignment, completion and history.
- Transit: mark milestones, timestamps; optional notifications and map.
- Logs: add/edit/delete chronological entries, validation and access checks.
- Profile: edit care context; restrict sensitive data to authorized family members.

## Course policy
Your IS216 guidelines allow AI mock data and UI concepts but restrict AI implementation of core business logic and critical interactions. Students should develop those themselves and disclose AI assistance as required.


## Updated multi-family navigation (mock UI)
- Switch the current family from the dropdown in the navbar. Family Home shows only that family's recipients and open tasks.
- Family Home → Open Tasks → Task Detail (view the unclaimed status and Claim Task placeholder).
- Family Home → Recipient Hub → Tasks → Task Detail.
- My Tasks shows assignments across both families and switches the active family when you open a task.
- Mock login does not authenticate; join-family, claiming, role rules, MongoDB and API persistence remain student implementation tasks.
- Sample data in `client/src/data/mock.js` is entirely fictional and in memory.

## Feature ownership
Marcus: family switching, authentication, family membership; Sera: Open Tasks, recipient tasks, task details / claim behavior, transit; Chaithra: recipient hub, profile, care overview and log. Others: My Tasks polish, family settings, integrations / tests.
