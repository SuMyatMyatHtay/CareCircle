# End-to-end tests

Recurring workflows are in `recurring-workflows.spec.mjs`: form creation,
whole-series claim, one-day handover, cancellation and one-session claims. They run
on both desktop/mobile projects using the local replica-set test database.
See [current setup and verification](../../docs/TESTING-RECURRING.md).

Run `npm run test:e2e` from the repository root. Playwright starts the real Vue
app and Express API, with a fresh local MongoDB process and test-only accounts.
It never runs `server/seed.js`, loads the server's `.env`, or uses a shared DB.

`mobile-layout.spec.mjs` checks 320px and 390px layouts: task tabs, complete invite
codes, member profile links, calendar filters, task-modal actions and form fields.
It also checks drawer state across viewport resizes and the assistant's clearance
from the task footer, including its composer in a short landscape viewport.

`mobile-actions.spec.mjs` checks the Home New task action at 320, 390, 767, 768
and 1280px, including empty/error states, recipient actions, household recurring
task editing/pause/resume, sidebar destinations, device appearance and search
filters. Transit workflows also verify phone directions, clinic search controls,
extra updates and ending/resuming without completing the task.

The same workflows run in desktop Chromium and a 390px mobile Chromium context:
signup validation/duplicate emails, family creation and joining, login/logout,
language saving, global dark mode, recipient create/edit/archive,
task creation/claim and family isolation, member roles, invite regeneration,
care-log translation/cache, care-log posting/filtering/editing/deleting, member
permissions and voice input, consultation notes added from a task, task editing,
the family Calendar (tasks and follow-up appointments, filters, months), and
expansion of multiple live trips.
Notification settings also cover event/reminder persistence, family isolation,
and a direct API permission check for ordinary members. Overdue deletion covers
the default restriction, an admin granting access, confirmation cancellation,
and preserving unselected/future tasks after deleting one selected task.
Application API responses are real. Azure alone uses a controlled provider double
in the test server; no live translation credential or paid request is needed.
The voice-input success case replaces only the `/integrations/transcribe` reply in
the browser, because Groq is paid; the no-key case uses the real 503 reply.
The language case gates a request to observe its pending
state before allowing the real request through. Decorative Google fonts are blocked.

Use `npm run test:e2e:headed` to watch. Use `pnpm exec playwright show-report` to
open the HTML report. Failure screenshots and traces are saved in `test-results/`.

See [the testing guide](../../docs/TESTING.md) for installation, test layers,
database isolation and which features remain outside the tested scope.
See [the Korean walkthrough](../../docs/TESTING-EXPLAINED.ko.md) for unit,
integration and E2E examples, props/emits, and the latest main coverage audit.
