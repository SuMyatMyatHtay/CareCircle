# Family Home and Family Settings (package B)

Implemented from the supplied Figma screenshots and CareCircle proposal, using the existing Vue 3 / Vue Router / Bootstrap / Axios stack. Every feature panel has its own component; each page view imports and assembles those panels.

## Run and preview

```sh
npm run dev:client
```

Open the URL Vite prints, then `/preview/home` or `/preview/settings`. These routes use fictional Tan family fixtures and need no login, API server, or database. A banner or compact profile label identifies the preview. Sample profile edits, task creation/claiming, role changes, member removal, invitation regeneration, language, and notification switches persist on this browser. **Reset sample** (desktop) or **Switch → Reset sample family** (mobile Settings) restores family fixtures. Preview edits do not call the server or send Telegram messages. Exiting preview follows normal router session checks and preserves any real account session.

Normal authenticated pages are `/home` and `/settings`. Start the backend using the existing project setup to use real families. The frontend uses `VITE_API_URL`, or `/api` through Vite's proxy, for B's new API calls.

## Composition

```text
client/src/
  components/common/
    CareAvatar.vue               Shared avatar or initials
    CareModal.vue                Dialog, Escape, focus trap and focus return
  features/family/
    views/FamilyHomeView.vue      Imports and assembles the Home panels
    components/
      HomeHeader.vue             Greeting and new-task action
      FamilyEmptyState.vue       Loading, error, no-family states
      TransitBanner.vue          Active journey panel
      RecipientOverview.vue      Recipient grid, loading/error/empty states
      RecipientCard.vue          Next task and unclaimed-task shortcut
      TodayTasks.vue             Reuses package D's TaskList/TaskListItem
      RecentUpdates.vue          Activity list
      LiveUpdateToast.vue        Task change feedback
      NewTaskModal.vue           Isolated preview form; normal pages use D's form
      RecipientSummaryModal.vue  Quick overview for fictional preview recipients
      MobileHomeHeader.vue       Family/date, greeting and settings shortcut
      MobileTransitCard.vue      Compact live transit banner
      MobileTodayTasks.vue       Today list and See all action
      MobileTaskCard.vue         Compact task row and turquoise claim action
      MobileHomeNavigation.vue   Home, Tasks, People, Activity and Me navigation
    composables/
      useFamilyWorkspace.js      Family/user/recipient context shared with layout
      useFamilyDashboard.js      Tasks, claims, activity, polling and stale-request guards
    services/dashboardApi.js     Adapters for existing feature endpoints
    data/previewFamily.js         Isolated fictional fixtures
  features/settings/
    views/FamilySettingsView.vue Imports and assembles the Settings panels
    components/
      SettingsHeader.vue
      FamilyMembersCard.vue      Member list, role menu, removal action
      InviteCodeCard.vue         Copy and regenerate
      LanguagePreferencesCard.vue
      AppearanceSettingsCard.vue
      TelegramSettingsCard.vue
      NotificationToggle.vue
      MobileSettingsProfile.vue      Account header and Edit action
      MobilePreferencesPanel.vue     Light/dark, notes-language dropdown, Telegram Manage
      MobileInviteCodeCard.vue        Native Share/copy fallback and regenerate action
      MobileFamilyMembers.vue        Compact roster and member-management entry
      MobileLogoutButton.vue
      MobileSettingsNavigation.vue   Home, Tasks, Calendar, Family, Me
      SettingsProfileEditor.vue      Name/phone form using the existing profile API
      MobileSettingsTasksPanel.vue   Lazy task list / seven-day agenda
    composables/
      useFamilySettings.js       Member/settings state and mutations
      useAppearance.js           Light/dark/device mode and browser persistence
      useSettingsAccountActions.js  Logout and family-state cleanup
    services/settingsApi.js       B member APIs; A's existing profile API
  styles/familyWorkspace.css      Responsive styles and theme variables
  features/family/styles/mobileFamilyHome.css  Home-only mobile layout
  features/settings/styles/mobileFamilySettings.css  Settings-only mobile layout
```

`AppLayout.vue` provides the shared context and sidebar. `FamilyHomeView.vue` and `FamilySettingsView.vue` contain page-level orchestration; panel components receive props and emit events. `EmptyFamilyHomeView.vue` remains a compatibility wrapper around the new Home view.

## Behavior and integration boundaries

- All normal recipient/task/member requests are scoped to the selected family ID. Family changes clear previous results and dialogs; late responses cannot replace the new family's data.
- Home reads C/D's shared TanStack Query caches. The full family task list stays available to recipient pages; Home filters active tasks from Singapore midnight through the next seven days locally. The main list shows today's tasks; clicking a recipient's unclaimed badge shows that recipient's unclaimed tasks in the fetched window. Cards show each recipient's next task. The header counts open tasks in that window.
- Normal Home opens D's full task creation modal, or `/tasks/new` on mobile. The small B form is used only in the isolated preview. D's task creation and claim endpoints are reused; successful changes update the shared cache immediately. A conflict refreshes the list. The normal dashboard refreshes tasks every 20 seconds while visible and displays changes without a page reload. Socket.IO is not yet wired into this repository; polling is the current implementation.
- Recent updates are an in-session task activity feed in normal mode. The preview also demonstrates care-log and transit updates. E's transit API/pages and F's logs remain available through their existing routes; their Home banner/feed integration remains future work.
- C's implemented recipient API, create/edit/archive screens and Hub are preserved. Normal Home and the sidebar open C's Hub, and the Add care recipient link opens `/recipients/new`. Query invalidations refresh both the sidebar and Home after changes. Cards support C's structured mobility fields. Preview recipients open a local quick summary.
- B's backend lives in `server/src/features/families/settings.controller.js`. It uses the existing Family schema without changing A's model. Member listing, role changes, removal/self-leaving, and invitation regeneration are connected in the existing family router. Only admins manage others. Conditional atomic writes protect the last admin and recheck the acting member's access at write time.
- Invitations generated by the backend are **10 hexadecimal characters**, matching A's current Join Family validation. `TAN123` is a visual fixture only. Relationship editing is not implemented because the existing membership schema has no `relationship` field; relationships are displayed only when returned by the data source.
- Language is saved through A's current `/auth/me` endpoint, which requires a complete profile body. The adapter fetches the current profile before updating `preferredLang`. The saved user patches the existing member row in place, without reloading the roster or navigating; success feedback floats above the page without shifting its layout. Translation itself belongs to the LibreTranslate integration; selecting a language does not pretend to translate notes.
- Appearance is saved in browser storage and applied at the document root to every route, including recipient pages, tasks, logs, transit, profile/avatar pages, authentication, and dialogs teleported to the body. Bootstrap controls share the same theme. Device mode follows `prefers-color-scheme` changes. The saved theme is applied before Vue starts to avoid a light flash on reload. CSS fallbacks retain each page's original light colors.
- Below 768px, Home uses the supplied mobile dashboard reference: family/date and greeting, compact transit, today's tasks, coral open-task cards with turquoise claim buttons, and fixed bottom navigation. **See all** opens the family task list; **Tasks** opens E's `/my-tasks` page in normal mode (the sample task list in preview); **People** opens care recipients and a member-settings link; **Activity** opens updates; **Me** opens Family Settings. Task creation is available from the full task list. The desktop Home layout remains as before.
- Below 768px, Settings follows the newer mobile reference: account header/Edit, compact preference rows, family Switch, invitation Share/regenerate, relationship/role roster, Log out and bottom navigation. A member row opens role/removal controls (admins), or self-leaving (normal members). Last-admin protections remain in place. Share uses native browser sharing when available for a real family; otherwise it copies the invite code. Preview always copies a sample code.
- Mobile profile editing saves only name and phone through A's existing full-profile endpoint; email is displayed as read-only. The adapter validates returned profile data, preserves unrelated preferences, and keeps both requests tied to the original sign-in. Late replies cannot replace a newer account's cached profile. Preview profile edits update the local sample member and shared profile header. Normal logout calls `/auth/logout`, clears user/session/family state, and returns to login. Preview logout exits the sample screens while preserving a real account's session. Sidebar and mobile logout share the same handler. A late logout reply cannot clear a different account that has signed in since the request started.
- Family-list requests are ordered and bound to the current sign-in. Clearing families invalidates pending requests; older successful or failed replies cannot overwrite a newer family list. A new sign-in clears the previous account's family cache before fetching its own records.
- The supplied mobile references have different navigation labels: Home retains **Home / Tasks / People / Activity / Me**; Settings follows **Home / Tasks / Calendar / Family / Me**. In Settings, Tasks opens `/my-tasks` in normal mode (an active-task list in preview), Calendar shows a read-only seven-day agenda, Family scrolls to the roster, and Me returns to account preferences. The full calendar and external Calendar API integration remain F's work; no month-view or external sync is claimed.
- Telegram controls demonstrate local preferences in preview mode. In normal mode they are disabled and labeled **Not linked** because F's group linking, notification preference API and reminder delivery are not implemented. No external messages are sent.

## Validation

```sh
npm run build
npm run test:family
```

The 34 tests require installed client and server dependencies. Eight HTTP tests run Express with mocked User/Family models and cover authentication, membership isolation, allowed fields, admin-only writes, last-admin preservation (including concurrent requests), self-leaving, and invitation format. Eighteen frontend tests load the real adapters and composable through Vite, with isolated HTTP/storage/navigation doubles. They cover preference preservation, malformed profile replies, session changes during saving/logout, retry behavior, preview isolation, duplicate clicks, and stale family requests. Five merge regression tests exercise the real B/C/D query hooks and task form: task creation updates Home without discarding completed/future tasks, recipient invalidation refreshes the workspace, family switches isolate late replies, previews skip authenticated queries, and an old list reply cannot undo a successful claim. Three additional regression checks cover an in-flight/failed language save without blanking the member list and the document-wide appearance preference, including system mode. These tests do not connect to or seed MongoDB. Live database integration still requires the team's MongoDB environment.

Browser checks cover desktop and 390px mobile layouts, task claim/create, language and theme persistence, notification toggles, invitation regeneration and navigation. The preview shows no horizontal overflow at the mobile width tested.

## Remaining scope after the mobile Settings audit

| Area | Current state | Remaining work |
| --- | --- | --- |
| Home / Settings visual structure | Desktop and dedicated mobile references implemented | Replace emoji/initials with final team avatar assets if supplied |
| Profile, preferences, invites, roles | UI and existing API adapters connected; sample actions persist locally | Validate end to end against the team's authenticated MongoDB environment |
| Relationships | Sample relationships shown; normal roster falls back to email | Agree with A on a persisted relationship field before relationship editing |
| Care recipients (CC-05) | C's API/CRUD/Hub retained and connected to Home/sidebar | Verify against the team's authenticated MongoDB environment |
| Telegram | Preference management in sample mode; real controls explicitly unavailable | F's group linking, preference API, delivery and reminder worker |
| Translation | Preferred language saved | LibreTranslate connection and translated notes |
| Transit / activity | E's transit routes and F's logs retained; Home has a sample timeline and in-session task changes | Connect Home to E's live transit and a persistent activity feed; Socket.IO integration |
| Calendar | Read-only seven-day agenda from existing task data | F's full calendar and external calendar integration |

## Attribution

AI-assisted implementation: Codex, 14 October 2026. Visual references: the user's attached Figma screenshots. Avatars use system emoji/initials; Bootstrap Icons come from the existing project dependency. No generated image assets or additional production packages were added.

## Integration with main (21 October 2026)

SangYoon was merged with the current main while preserving the recipient Hub/CRUD, D's full task form and shared query cache, E's My Tasks/transit, F's logs, and the team avatar assets. The three textual conflicts were in the sidebar, the old Home entry point, and this package's API documentation. The new Home view retains the old entry point as a wrapper. The original branch and main commit have local backup refs and a verified Git bundle.

Member management menus and the sidebar family picker close on pointer clicks or keyboard focus outside the menu, and on Escape. Event listeners are removed when their components unmount.
