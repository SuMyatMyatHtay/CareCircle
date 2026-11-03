# CareCircle website and permission audit

Reviewed 2 November 2026 (Singapore time). This audit uses local source, disposable local MongoDB replica sets, and desktop/mobile Chromium. No shared application database was changed, and no real Telegram, Google, Gemini, speech, or translation account was used.

**The ordinary permission guards mostly work, but there are two high-priority authorization gaps: assistant deletion and Telegram group commands.** Passing the existing tests does not establish that these gaps are safe: the targeted audit reproduces behavior the existing suite did not cover.

**Follow-up status:** F01 (assistant deletion), F05 (conditional individual deletion), and F07 (mobile recurrence controls) have since been addressed. The original audit results below remain a historical snapshot. The assistant permission fix passed 151 server regressions, 122 client tests, 64 API tests, and 6 desktop/mobile overdue workflows. Other findings remain open unless noted.

## Verification

| Check | Result |
| --- | --- |
| Server regression tests | 148 passed after test-only mock repairs |
| Client component/unit/integration tests | 121 passed |
| Test-database isolation checks | 2 passed |
| API integration tests against real MongoDB | 50 passed after correcting future-task fixtures |
| Main desktop/mobile browser workflows, including six new overdue checks | 59 passed; 1 failed: mobile repeating-task management is absent |
| Additional account/profile/page browser checks | 4 passed: registration, family creation, profile persistence, and authenticated page smoke checks at both viewport sizes |
| Targeted permission and behavior scenarios | 16 scenarios recorded in the evidence JSON; the first includes 24 family-read checks, followed by 8 admin-route checks and 6 task-ownership checks |
| Targeted database-free probes | 5 reproductions confirmed, including assistant and Telegram authorization and reminder failures |
| Production build | Passed; existing large-bundle warning remains |

The initial baseline had 7 server regression failures, 3 API failures, and browser failures caused by missing database mocks, expired task fixtures, and an outdated greeting assertion. These were test setup defects, not evidence of new application defects. Test-only changes allow those workflows to run. Application behavior was not patched during this audit.

The isolated database run used MongoDB 7.0.14 because the default parallel download into the shared MongoDB cache failed. Transactions and replica-set behavior were enabled.

## Findings to fix

### F01 - High: the assistant bypasses overdue deletion permissions and omits the deletion summary

**Follow-up:** fixed with shared `tasks/permissions.js` and `tasks/deletionService.js`. Assistant drafts, both confirmations, and final deletion read current family membership/settings. Successful deletion records one actor/count summary; retries do not duplicate it. Legacy proposals, revoked permissions, demotion, different-family settings, recurring tombstones, and locked tasks are covered by real API tests in `tests/integration/assistant-permissions.test.mjs`.

**Confirmed against the real API and database.** With the family setting at its default, a non-admin who created an overdue task receives HTTP 403 from the ordinary deletion endpoint, but HTTP 200 from a confirmed assistant deletion. The task is actually removed, and zero deletion notifications are recorded. Conversely, an admin can delete another creator's overdue task normally but receives HTTP 403 through the assistant.

Reproduce with a member-owned, open task in the past: prepare/confirm an assistant delete proposal for that member. Compare it with `DELETE /api/families/:familyId/tasks/:taskId`. An admin-owned proposal for another creator's task demonstrates the reverse mismatch. The audit used saved proposals and the real confirmation endpoint, without calling Gemini.

Cause: `server/src/features/assistant/service.js:86` still permits deletion only by creator; its context flags at line 205 use the same old rule. The confirmation delete branch around line 295 calls database deletion directly and does not call `notify()`.

Fix: use one shared deletion service for manual, bulk, and assistant writes. Recheck the current family setting and task state, then emit exactly one summary with the actual actor and actual deletion count. Preserve the assistant's double confirmation and stale-proposal protection.

### F02 - High: Telegram commands bypass family-admin authorization

**Linking confirmed by executing the real webhook handler with model/provider doubles.** A valid Telegram-delivered update from an unknown sender with an invite code can link a different group to a family. The database update succeeds even when no family member was matched and `linkedBy` is null. The webhook secret authenticates Telegram's delivery, not the human issuing the command.

`/unlink` also accepts any sender in the linked chat; its implementation never checks the sender's identity or family role. The website's admin-only unlink restriction therefore does not cover the bot path.

Source: `server/src/features/integrations/telegram.js:70`, `:81`, `:86`, `:93`, `:106`.

Fix: require an admin-approved, short-lived linking flow and a verified Telegram account ID. Check the verified actor on unlink as well. A user-editable Telegram username alone is not sufficient proof of identity. Keep group changes and displacement of another family's group binding atomic.

### F03 - Medium: passwords longer than 72 bytes silently lose their suffix

**Confirmed through registration and login.** A 77-byte password was accepted at registration, and a different 81-byte password with the same first 72 bytes successfully authenticated. The registration form/server allow up to 128 characters while bcrypt ignores input beyond its byte limit.

Source: `server/src/features/auth/register.controller.js:16`, `:25`; `server/src/features/auth/service.js:16`.

Fix: choose a deliberate password-length policy measured in UTF-8 bytes or use a password-hashing scheme that supports the desired input length. Plan compatibility with existing hashes; do not silently change the interpretation of existing passwords.

### F04 - Medium: login and registration have no application-level abuse throttle

**Confirmed locally:** twenty consecutive wrong-password attempts all returned HTTP 401; no request was throttled. Only assistant chat has a local quota. This audit does not establish whether the hosted deployment has a separate gateway limit.

Source: `server/src/features/auth/routes.js:9`; `server/src/app.js`.

Fix: add a shared, bounded limit for failed login attempts by account and source, and registration limits. Include a safe recovery path so account lockout cannot be abused to deny access to another person.

### F05 - Medium: individual overdue deletion does not recheck the decisive state when writing

**Follow-up:** addressed by the shared deletion service, which includes the exact task status, start time, assignee and update version in its conditional write. A real API regression reschedules the task between the read and delete and verifies HTTP 409 with the task preserved.

**Confirmed with a controlled interleaving and real database writes.** An admin starts deleting another member's overdue task. The task is moved into the future between the initial read and the deletion. The handler still deletes it and returns HTTP 200, although that admin could not normally delete another creator's future task.

Source: `server/src/features/tasks/controller.js:467`, `:477`; `server/src/features/tasks/TaskModel.js:175`. The ordinary delete filter checks only ID/family/undeletable statuses, while bulk deletion already includes deadline/status/update-version conditions.

Fix: include the expected update version, exact eligible status, and deadline in the conditional write. A changed task should produce HTTP 409. Apply the same shared service to every deletion entry point.

### F06 - Medium: removing a member leaves ordinary tasks assigned to that removed person

**Confirmed against the real API.** Removing a person who both created and claimed an ordinary task returns HTTP 204. Their access is correctly revoked (HTTP 403), but the task stays `claimed` by that user. An admin trying to unclaim it also gets HTTP 403 because only creator/claimer may unclaim. Other members cannot take the task. Cancellation and recreation are a workaround, not a handover.

Source: `server/src/features/families/settings.controller.js:113`; the unclaim permission in `server/src/features/tasks/controller.js`. Recurring usual-helper cleanup exists separately and does not solve all ordinary or independent-session assignments.

Fix: define a departure/removal workflow that releases or explicitly transfers future work, preserves completed history, and handles active trips deliberately. Provide an audited admin recovery operation for work left without an authorized owner.

### F07 - Medium: mobile Home cannot display/manage repeating task series

**Follow-up:** addressed after this audit. Mobile Home now includes the series panel, all unclaimed recurring rows offer a three-dot menu with Stop repeating, and the server enforces the shared family task-permission setting (admins only by default) for stopping/resuming. The targeted recurring browser suite passed all 12 desktop/mobile cases, including stopping after the overdue session has been deleted. Original audit results below are retained as historical evidence.

**Confirmed by the remaining end-to-end failure.** Creating six sessions on mobile succeeds and all six persist, but reloading Home gives no accessible `Repeating tasks` heading or management panel. Desktop Home renders `RecurringSeriesPanel`; mobile Home does not. Recipient task pages can provide an alternative for recipient-linked series, but household series have no recipient hub fallback.

Source: `client/src/features/family/views/FamilyHomeView.vue`, desktop versus mobile branches. Reproduction test: `tests/e2e/recurring-workflows.spec.mjs:18` on `mobile-chromium`.

Fix: make series edit/pause/resume accessible from the mobile task panel or a dedicated series section. Keep creator permissions consistent with the existing backend.

### F08 - Medium: turning off unclaimed-task reminders does not stop them

**Confirmed against real MongoDB:** with all reminder flags false and a due unclaimed task, `runDueReminders()` still creates a `task.unclaimed_soon` notification. Provider delivery was isolated; no actual group was contacted.

Cause: `server/src/features/notifications/reminder.js:109` calls `unclaimedAlerts()` unconditionally, then conditionally calls it again at line 111. The atomic reminder flag prevents most duplicates, but the off switch is ineffective.

Fix: remove the unconditional call and verify each flag independently, including false-to-true changes and concurrent sweeps.

### F09 - Medium: the alternate reminder endpoint throws instead of running

**Confirmed by invoking its handler.** `POST /api/integrations/reminders` with valid cron authorization throws `ReferenceError: runAllDueReminders is not defined` because the function is never imported. Express 4 does not automatically forward this rejected async handler to error middleware; this can become an unhandled rejection rather than a controlled response.

Source: `server/src/features/integrations/routes.js:20`.

The separate `/api/cron/reminders` route imports the function correctly. This finding does not mean both endpoints are broken.

Fix: keep one supported cron endpoint, or import the function and forward failures correctly. Document and test the URL actually configured in the scheduler.

### F10 - Medium: Calendar silently drops follow-up appointments after 50 matching notes

**Confirmed API cap plus source review.** With 51 appointment notes in the displayed range, the query returns 50. The Calendar makes one `limit: 50` request and does not load another page or tell the user appointments are omitted.

Source: `client/src/features/calendar/views/CalendarView.vue:48`; `server/src/features/logs/controller.js:205`.

Fix: paginate through the complete appointment range or provide a range-specific endpoint with an explicit continuation cursor. Make incomplete results visible if a cap remains.

### F11 - Medium: ordinary task creation accepts archived recipients

**Confirmed against the real API:** an archived recipient still accepts a new ordinary task (HTTP 201). The assistant rejects a recipient unless `isActive: true`, and the normal picker shows active recipients. These entry points disagree about whether archived profiles may receive new work.

Source: `server/src/features/tasks/TaskModel.js:197`; compare `server/src/features/assistant/service.js:113`.

Fix: enforce one active-recipient policy in a shared validation function. If historical edits need archived recipients, allow that explicitly without permitting fresh assignments accidentally.

### F12 - Low: malformed input is reported as an internal server failure

**Confirmed HTTP response:** a top-level JSON string supplied to `/api/auth/login` is rejected by Express's JSON parser with status 400 internally, but the global error handler replaces it with HTTP 500 and `Internal server error`.

Source: `server/src/app.js:96`.

Fix: preserve safe parser/validation status codes and messages (including payload-too-large errors); reserve HTTP 500 for unexpected failures. Do not return raw stacks or submitted payloads to the client.

### F13 - Low: permission controls can stay stale in another open session

**Source-reviewed; not a demonstrated server bypass.** Role and deletion visibility use the locally cached family from `useActiveFamily()`. AppLayout loads families on mount; normal task polling does not refresh family permissions. A second session can continue showing old deletion/admin controls after an admin changes access elsewhere. The server still checks membership/role on each new request.

Source: `client/src/components/layout/AppLayout.vue:55`; `client/src/composables/useActiveFamily.js:26`; `client/src/features/family/composables/useFamilyWorkspace.js:61`.

Fix: refresh family permissions on settings changes, focus/reconnect, and authorization errors, or distribute a family-permissions invalidation event. Treat server permission failures as a reason to update the visible controls.

### F14 - Low: README describes obsolete task permissions and editing behavior

**Source-confirmed documentation mismatch.** The permission table says creator-only deletion and says admins cannot delete another person's task, without the overdue setting exception. A feature bullet also calls the conventional ordinary-task Edit button a placeholder, although desktop/mobile editing tests pass.

Source: `README.md`, Tasks and shared responsibilities and Task lifecycle and permissions.

Fix: document ordinary versus overdue deletion, the default/override setting, and actual editing behavior. Update this after F01 is resolved so the assistant and normal interface promise the same rules.

## Controls that passed

- All 24 family-read checks: authenticated members can read; outsiders get HTTP 403; unauthenticated requests get HTTP 401. Covered members, tasks, recipients, logs, notifications, notification settings, transit, and search.
- All eight tested admin-management routes deny an ordinary member: task permissions, member role/removal, invite regeneration, recipient archive, and Telegram/notification management.
- All six unrelated-member task-write checks deny edits, deletion of future tasks, start, complete, unclaim, and cancellation.
- Removed family members cannot read the family's data after removal.
- Last-admin protections and the existing member-role concurrency tests pass.
- Care-log author/admin checks and same-family reference checks pass in the existing suites; an unrelated member's edit was also denied by the targeted audit.
- Normal selected overdue deletion respects the setting, ignores future/completed tasks, and writes the actual deleter/count summary. Desktop/mobile checks cover checkbox placement, selected deletion, defaults, settings persistence, and disabled member controls.
- Unrelated account profiles return HTTP 404; shared-family profiles remain available. Password hashes are absent from the registration response.
- Valid avatar saves succeed; locked characters are denied server-side.
- Registration and family creation work in both browser sizes, with the creator assigned admin and overdue deletion defaulting to admin.
- Existing browser checks cover login/logout, task edits, family switching, role changes, care notes/translation, Calendar, transit companion/follower controls, recurring claims/handover, appearance, and language saving.

## Scope and limitations

This is a broad local audit, not a claim that every possible combination or deployment configuration was exercised. There was no load test or destructive test of the deployed site. Live Google OAuth/sync, real Telegram delivery, actual speech-provider billing/transcription, Gemini generation, and live OneMap/GPS behavior were not exercised. Their server access checks and available tests were reviewed; external providers were disabled or doubled. Password reset is explicitly marked as a later feature and has no implemented recovery workflow.

The initial shared-cache download and sandbox teardown failures were test-environment problems. Final browser runs used isolated tooling/process permissions and a workspace-local MongoDB binary. The production application's dependencies and source behavior were not changed to make tests pass.

## Artifacts and next work

- Structured real-API evidence: [2026-11-02-permission-evidence.json](2026-11-02-permission-evidence.json).
- New browser checks: `tests/e2e/overdue-permissions.spec.mjs` and `tests/e2e/account-audit.spec.mjs`.
- Test-only maintenance: `tests/unit/assistant.test.mjs`, `tests/unit/task-claim.test.mjs`, `tests/integration/family-api.test.mjs`, `tests/e2e/fixtures.mjs`, `tests/e2e/family-workflows.spec.mjs`.
- Detailed local logs: `.test-runtime/audit-regression-final.log`, `audit-client.log`, `audit-support.log`, `audit-api-final.log`, `audit-e2e-final.log`, `audit-account-e2e-final.log`, `audit-permission-api.log`, `audit-probes.log`, and `audit-build.log`.

Fix F01 and F02 first, then password/authentication behavior and assignment/deletion integrity. Add denial tests that cover every write entry point; a successful normal-UI test must not substitute for an assistant or bot authorization test. The application findings were open at the end of the original audit; F01, F05 and F07 have since been addressed as noted above.
