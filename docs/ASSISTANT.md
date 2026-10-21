# CareCircle assistant

The floating mascot uses the signed-in user's saved dress-up appearance. The chat supports task search, task creation and editing task details. It asks for missing details and presents a confirmation card before writing. It cannot delete, assign, claim, cancel or complete tasks.

## Setup

Add to **server/.env** (the backend's working directory):

```dotenv
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Restart the backend after editing the environment. The downloaded `backend.env` file is not loaded automatically: copy the settings into `server/.env`. Keep the key out of frontend/VITE variables, commits, and chat messages. No extra SDK dependency is required; the server calls Google's REST API with Node's native fetch (Node 20+).

The default model is configurable. Choose a structured-output text model available to your Google AI Studio project. Free-tier availability and quotas depend on the project; a 429 produces a helpful message without automatic retries. Current references: [structured output REST API](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [pricing and free tier](https://ai.google.dev/gemini-api/docs/pricing).

## Try it

1. Sign in, select a family and open the floating mascot.
2. Ask “Add an eye check for Grandpa on Friday.” Supply the time and location when asked. Inspect the confirmation card: **no task is created yet**.
3. Press **Confirm task**. Family Home, recipient task lists, My Tasks and an open task-detail page refresh.
4. Ask “Find Grandpa's appointments this week.” Select a matching task, say what to change, inspect the old/new values, and confirm.
5. Try Dismiss, a fresh chat, and switching families. Try an update as a member who did not create the task: existing task permissions still apply.

## API and data flow

All routes are behind the existing authentication and family-membership middleware:

- `POST /api/families/:familyId/assistant/chat` with `{ messages: [{ role: 'user' | 'assistant', content: string }] }`
- `POST /api/families/:familyId/assistant/proposals/:proposalId/confirm`
- `POST /api/families/:familyId/assistant/proposals/:proposalId/cancel`

Gemini returns a structured intent; it never receives database tools. The server validates the proposed fields using the same task parser and Mongoose schema as the task form. Proposals are stored in MongoDB's `assistantproposals` collection, scoped to user and family, and expire after 15 minutes. Confirmation sends only the proposal ID, not an editable payload. It atomically claims the proposal and rechecks current permissions, recipient membership and task validation. Edits use the task's original `updatedAt` as an optimistic concurrency condition; a stale preview cannot overwrite newer task details. Repeated confirmations cannot create duplicate tasks. Uncertain write failures require checking tasks, rather than blindly submitting a new task.

Messages stay in browser memory and clear on family/account changes or a new chat. Requests are cancelled and late replies discarded on context changes. A bounded window of conversation and up to 80 recent/upcoming tasks plus 100 recipient names is sent to Gemini for context. Database searches can find tasks outside that snapshot and return up to 10 matching cards. Medical records, passwords, contact details, profile pictures and API credentials are excluded from the context. Task titles, locations and user messages can still contain personal information. The chat includes a data-use disclosure; Google's free tier may use submitted content to improve products, as described on its pricing page. Use sample data for a class demonstration.

Chat requests have a per-user, per-server-process limit of 10/minute, a 20-second Gemini timeout, and bounded input/output. A deployment with multiple instances needs a shared rate limiter for a global quota. No chat transcript persistence, voice input, recurring tasks, location lookup or proactive reminders are implemented.

## Validation

```sh
npm run build
node --test tests/unit/*.test.mjs
```

The automated tests use mocked Gemini and database models; they never call the paid API or mutate shared MongoDB data. A live Gemini smoke test requires a configured API key and running database.
