# Draft API contract — confirm before implementation

| Owner | Mount path | Planned actions |
|---|---|---|
| Marcus | `/api/auth` | register, login |
| Marcus | `/api/families` | list, create, join |
| Chaithra | `/api/care-profiles` | list, create, detail, update |
| Sera | `/api/tasks` | list, create, detail, update, delete, claim/unclaim/complete through a defined action |
| Chaithra | `/api/care-logs` | list and create |
| Sera | `/api/journeys` | update milestone status |
| Optional teammate | `/api/integrations` | OneMap search and Telegram (only if approved) |

## Shared conventions
- Confirm JSON shapes, IDs, error formats, and authentication before coding feature implementations.
- All records must be scoped to an authenticated family/member on the server.
- `recipientId` links tasks and logs to a care recipient; `familyId` links recipients to a family.
- Never store real patient data for demonstrations.
- API placeholders currently return HTTP 501. `/api/health` returns 200.
