# CareCircle assistant

The floating mascot uses the signed-in user's saved dress-up appearance. Chat supports task search and confirmed proposals to create, edit, claim, assign, unclaim, start, complete, cancel or delete tasks. It asks for missing details before showing a confirmation card. Deletion requires a second confirmation. It does not provide medical advice.

## Ownership and task actions

- Claim: claim an open, future family task for yourself. Overdue tasks cannot be claimed.
- Assign: the creator can assign an open, future task to a current family member. Existing claims must be released first.
- Start/complete: only the assigned person can act, using the same task/transit lifecycle as the manual UI.
- Cancel: creator or assigned person; admin status alone does not grant assistant ownership.
- Unclaim: creator or claimer, while the task is still claimed.
- Edit/delete: creator only; lifecycle restrictions remain in force.

Permissions, assignee membership, status, deadlines and task version are rechecked on confirmation. Changes refresh shared task caches/listeners; status actions use the shared lifecycle handlers for notifications and transit.

Selecting a result sends `selectedTaskId` and `selectTask: true` with the conversation. The server validates its family and returns a deterministic follow-up without Gemini. Subsequent messages retain `selectedTaskId`; Change time/Change location asks for the new value directly. An incomplete model update becomes a clarification instead of an empty-edit error. Selection clears on family/account changes or a new chat.

Edit questions also return an `editField` that the client carries with the next answer. Title and notes answers become exact, validated update proposals without a Gemini call; time/location questions give the model the explicit field context. Ownership and locked-status checks run before asking for changes and again on confirmation. Non-retryable validation/permission failures appear as explanatory chat replies without a Try again button. Incomplete creation drafts ask for missing details rather than attempting to save them.

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

Chat requests have a per-user, per-server-process limit of 10/minute, a 45-second Gemini timeout, and bounded input/output. The client has a 55-second request deadline and a Stop waiting button. A deployment with multiple instances needs a shared rate limiter for a global quota. No chat transcript persistence, voice input, recurring tasks, location lookup or proactive reminders are implemented.

## Validation

```sh
npm run build
node --test tests/unit/*.test.mjs
```

The automated tests use mocked Gemini and database models; they never call the paid API or mutate shared MongoDB data. A live Gemini smoke test requires a configured API key and running database.
