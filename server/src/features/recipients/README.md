# recipients
Owner: Jhen (C)

Care recipients of a family. Mounted at `/api/families/:familyId/recipients`, behind `requireAuth` and `requireFamilyMember`. Full request and response shapes are in [docs/API-CONTRACT.md](../../../../docs/API-CONTRACT.md), section C.

| Method | Path | Who | What it does |
|---|---|---|---|
| GET | `/` | member | List recipients, sorted by name. Active only unless `?includeArchived=true`. |
| POST | `/` | member | Create a recipient. `name` and `careType` are required. |
| GET | `/:recipientId` | member | One recipient. |
| PATCH | `/:recipientId` | member | Edit any field except `family` and `isActive`. Changed medications are stamped with `updatedBy`/`updatedAt`. |
| POST | `/:recipientId/archive` | admin | Set `isActive: false` and clear `linkedUser`. There is no DELETE. |

- `linkedUser` can only be set to your own account (`403` otherwise), never on an infant (`400`), and must be a member of the family. Anyone can unlink. One account links to at most one recipient per family (`409` otherwise).
- The model is registered as `CareRecipient` in the `carerecipients` collection. Tasks (D) and logs (F) look it up by that name and populate `name nickname careType`, so keep those names.
