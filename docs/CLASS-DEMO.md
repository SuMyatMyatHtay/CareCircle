# Classroom demo

The fictional **Class Demo Family** has four accounts, three active recipients,
69 tasks, and four care notes. All accounts use **CareCircleDemo123!**.

54 tasks form an additional completed history across all four members, with
different totals, categories, and completion dates over the past month. Each
member has recent completions so the leaderboard's week, month, and all-time
views show contributions. Existing demo tasks and classroom edits are preserved.

| Email | Name | Family role |
| --- | --- | --- |
| ethan.demo@carecircle.test | Ethan Lim | Admin |
| priya.demo@carecircle.test | Priya Kumar | Admin |
| daniel.demo@carecircle.test | Daniel Wong | Member |
| chloe.demo@carecircle.test | Chloe Lee | Member |

Recipients: Grandpa (Tan Ah Kow), Grandma (Lim Siew Lan), and Baby Emma.
All people, conditions, care notes and appointments are fictional.

## Load into the current application database

Configure `MONGODB_URI` in `server/.env`, then run from the repository root:

```sh
npm run seed:demo --prefix server
```

This adds a separate family to the configured database. It never clears
collections or overwrites existing demo records. Rerunning adds missing demo
records and preserves classroom edits. It does not reset passwords or refresh
existing dates. Task dates are relative to the initial seed time in Singapore.
The older `npm run seed --prefix server` script clears data; use `seed:demo`
for this additive classroom setup.

Validate the document shapes without connecting or writing:

```sh
npm run seed:demo --prefix server -- --check
```

## Suggested walkthrough

1. Log in as Ethan and select Class Demo Family if a different family is selected.
2. Explore recipients and open each Profile, Tasks and Log tab.
3. On Home, browse Upcoming, Overdue, Claimed, In progress and Completed.
4. Claim an open task, then inspect it under My Tasks. Complete the care-folder
   task already in progress, or start the claimed clinic trip.
5. Open Calendar for upcoming appointments and the follow-up from a care note.
6. In Settings, inspect membership, invitation sharing, and permissions. Compare
   Ethan's admin controls with Daniel's or Chloe's member controls.
7. Add a care note or create a task. Classmates share the same demo family, so
   these changes are visible to everyone.

No Telegram chat, external integration credentials, or real contact information
is seeded. Translation, voice input, and map integrations use the app's existing
configuration. A future-day trip asks for confirmation before moving it to now.

To run the application locally, use `npm run dev` from the repository root and
open the frontend URL printed by Vite. For a hosted app, load the demo into the
same database used by its backend and share the hosted frontend URL.
