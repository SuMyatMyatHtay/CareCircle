# End-to-end tests

Run `npm run test:e2e` from the repository root. Playwright starts the real Vue
app and Express API, with a fresh local MongoDB process and test-only accounts.
It never runs `server/seed.js`, loads the server's `.env`, or uses a shared DB.

The same workflows run in desktop Chromium and a 390px mobile Chromium context:
login/logout, language saving, global dark mode, recipient create/edit/archive,
task creation/claim and family isolation, member roles, and invite regeneration.
API responses are real. The language case gates a request to observe its pending
state before allowing the real request through. Decorative Google fonts are blocked.

Use `npm run test:e2e:headed` to watch. Use `pnpm exec playwright show-report` to
open the HTML report. Failure screenshots and traces are saved in `test-results/`.

See [the testing guide](../../docs/TESTING.md) for installation, test layers,
database isolation and which features remain outside the tested scope.
