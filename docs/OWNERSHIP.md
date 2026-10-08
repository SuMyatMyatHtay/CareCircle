# Feature ownership (3 reliable / 3 potentially unavailable)

| Role | Frontend directory | Backend directory | Deliverable |
|---|---|---|---|
| Marcus (critical) | `auth/`, `family/` | `auth/`, `families/` | login, family creation/join, shared backend foundation |
| Sera (critical) | `tasks/`, `transit/` | `tasks/`, `journeys/` | recipient tasks, task details, claim/complete, milestones |
| Chaithra (critical) | `recipients/`, `overview/`, `logs/` | `recipients/`, `logs/` | recipient hub, profiles, overview, consultation log |
| Teammate 4 (optional) | `my-tasks/` | task query coordinated with Sera | personal task listing and filters |
| Teammate 5 (optional) | `settings/` | families update coordinated with Marcus | member management, settings |
| Teammate 6 (optional) | `integrations/` if a Vue screen is needed | `integrations/` | OneMap, Telegram, optional gratitude |

Each person must contribute code. Keep critical tasks with Marcus/Sera/Chaithra. Optional teammates should open small PRs, not directly edit shared contracts.

## Shared-file ownership
- Marcus maintains `server/src/app.js`, `server/src/routes/index.js`, DB config, root setup.
- Sera coordinates `client/src/router/index.js` and shared frontend setup.
- Ask before editing these files; do not develop directly on `main`.
- Agree on API payloads in `docs/API-CONTRACT.md` early.
