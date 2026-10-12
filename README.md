# CareCircle 💚🩷

**Care together, closer always.**

CareCircle is a family-care coordination web application for sharing caregiving responsibilities, tracking appointments and tasks, and keeping loved ones informed. Family members can join multiple family circles, view tasks that still need volunteers, and coordinate care for individual recipients.

> **IS216 Group Project · Section G8 · In development.** features and integrations listed below are project scope, not necessarily completed functionality yet. Please refer to the project tracking sheet for details.

## 🔗 Project resources

| Resource                                           | Link                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task allocation & progress tracker                 | **[CareCircle Task Allocation](https://docs.google.com/spreadsheets/d/1q4JjWnC077RomNEm6pJjR2DpeRkb-RZyNa4O9ssRjLk/edit?gid=77767454#gid=77767454)** |
| Wireframes (Figma)                                 | [Open wireframes](https://www.figma.com/design/oo8lDXmN1OIF7zJ75SPn3a/Preline-UI-Figma--Community-?node-id=299804-16564&t=bZtps8beujV1iiui-1)                                   |
| Project proposal, specifications & database design | [Team Google Doc](https://docs.google.com/document/d/1C0RIz2fLhAb1berm-wca4x8c-Li_FNyRMWFHNJV37T8/edit?tab=t.0)                                                                 |
| Presentation Slide for Project Update (13th Oct) | [Canva Link](https://www.canva.com/design/DAHXlRxCktA/P5yOdcJa_RUiOY1k8l6CRQ/edit)                                                                 |
| Hosting | [Vercel Web](https://care-circle-delta-one.vercel.app/)                                                                 |

## ✨ Project scope

- **Authentication & Families:** sign up, log in, log out, create or join families, switch between multiple families, and enforce family membership access.
- **Family Dashboard & Settings:** household overview, upcoming tasks, members, roles, and preferences.
- **Care Recipient Management:** care profiles with overview, tasks, logs, and profile details.
- **Task Management:** create, edit, claim, unclaim, and complete caregiving tasks; browse unclaimed tasks.
- **My Tasks & Transit:** view claimed tasks across families, track appointment journeys with timestamps and progress updates.
- **Care Logs & Integrations:** consultation notes, task calendar, and planned Telegram reminders/notifications.
- **Gamification:** profile badges, leaderboard, spotify-inspired yearly wrap

## 🧰 Tech stack

| Area                 | Technology                                                |
| -------------------- | --------------------------------------------------------- |
| Frontend             | Vue 3, Vite, Vue Router, Bootstrap, Axios                 |
| Backend              | Node.js, Express.js                                       |
| Database             | MongoDB, Mongoose                                         |
| Authentication       | bcrypt password hashing, JWT                              |
| Planned integrations | Telegram Bot API, OneMap, Google Calendar, LibreTranslate |

## 🚀 Local setup

**Prerequisites:** Node.js 20+, npm, and access to a MongoDB instance.

1. Clone the repository and enter the project folder.
2. Install dependencies from the repository root:

   ```bash
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

3. Create `server/.env` from `server/.env.example` (or create it manually):

   ```env
   PORT=3000
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/carecircle
   JWT_SECRET=replace_with_a_long_random_secret
   ```

   For frontend API setup, create `client/.env`:

   ```env
   VITE_API_URL=http://localhost:3000/api
   ```

4. Start both apps:

   ```bash
   npm run dev
   ```

| Service          | Local URL                                                                            |
| ---------------- | ------------------------------------------------------------------------------------ |
| Frontend         | http://localhost:5173                                                                |
| Backend          | http://localhost:3000                                                                |
| API health check | http://localhost:3000/api/health                                                     |
| Login endpoint   | `POST http://localhost:3000/api/auth/login` (when implemented in the current branch) |

**Do not commit `.env`, database credentials, JWT secrets, or real patient information.** Use fictional data for development and demonstrations.

## 🗂️ Project structure

```text
CareCircle/
├── client/
│   └── src/
│       ├── features/       # Vue pages/components organized by feature
│       ├── router/
│       ├── assets/
│       └── styles/
├── server/
│   └── src/
│       ├── features/       # Feature-specific models, routes and controllers
│       ├── middleware/     # Shared auth and family access checks
│       ├── config/         # Database setup
│       └── routes/         # API router registration
├── docs/                  # Project contracts and team notes
└── README.md
```

## 👥 Work packages

| Package | Scope                       |
| ------- | --------------------------- |
| A       | Authentication & Families   |
| B       | Family Dashboard & Settings |
| C       | Care Recipient Management   |
| D       | Task Management             |
| E       | My Tasks & Transit          |
| F       | Care Logs & Integrations    |

See the **[task allocation tracker](https://docs.google.com/spreadsheets/d/1q4JjWnC077RomNEm6pJjR2DpeRkb-RZyNa4O9ssRjLk/edit?gid=77767454#gid=77767454)** for current owners, priorities, blockers, and progress. The tracker is the source of truth for assignments.

## 🧑‍💻 Collaboration guidelines

1. Create a feature branch, e.g. `feature/auth-login` or `feature/task-board`.
2. Keep frontend/backend changes inside the corresponding feature folders where possible.
3. Agree on API contracts and database fields before changing shared schemas or middleware.
4. Submit a pull request with a short description, screenshots (for UI changes), testing steps, and any blockers.
5. Test at both desktop and mobile widths; check loading, empty, success, and error states.
6. Do not reset the shared MongoDB seed data without informing the team.

## 🔐 Data access conventions

A user may belong to **multiple families**. Family-specific records must be scoped to a family ID, and backend routes must verify the authenticated user's membership before exposing the data. Protect care notes and avoid placing sensitive medical details in external notifications.

## 📌 Status & attribution

CareCircle is an ongoing student project. We will be updating the details of the finished individual features along the line by documenting AI-assisted work and external assets according to the course requirements. We will not be treating mock screens or proposed API integrations as live functionality until tested.
