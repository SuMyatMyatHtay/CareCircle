    import { Router } from 'express'
    import { requireAuth } from '../middleware/requireAuth.js'
    import { requireFamilyMember } from '../middleware/requireFamilyMember.js'
    import auth from '../features/auth/routes.js'
    import families from '../features/families/routes.js'
    import recipients from '../features/recipients/routes.js'
    import tasks from '../features/tasks/routes.js'
    import transit, { familyTransit } from '../features/journeys/routes.js' // folder still named journeys
    import me from '../features/my-tasks/routes.js'
    import logs from '../features/logs/routes.js'
    import integrations from '../features/integrations/routes.js'
    import googleCalendar, { googleCallback } from '../features/calendar-sync/routes.js'
    import { calendarAutoSync } from '../features/calendar-sync/autoSync.js'
    import assistant from '../features/assistant/routes.js'
    import notifications, { notifySettings } from '../features/notifications/routes.js'
    import search from '../features/search/routes.js'

    const router = Router()

    // ---- Not tied to one family ----
    router.use('/auth', auth)
    router.use('/integrations', integrations) // Telegram webhook
    // router.use('/users', users)            // B: PATCH /users/me (add when built)
    router.use('/me', me)                     // E: GET /me/tasks
    router.use('/me/google', googleCalendar)  // E: Google Calendar sync (connect, status, sync)
    router.use('/google', googleCallback)     // E: Google sends people back here after "Allow"

    // Families, members and settings. Guards are set per route inside this router.
    // Must come BEFORE the family guard below, otherwise /families/join
    // would be read as familyId = "join".
    router.use('/families', families)

    // ---- Family guard: every /families/:familyId/<feature> request ----
    router.use('/families/:familyId', requireAuth, requireFamilyMember)

    // ---- Family features ----
    router.use('/families/:familyId/recipients', recipients)
    router.use('/families/:familyId/tasks/:taskId/transit', transit) // must come before /tasks
    router.use('/families/:familyId/tasks', calendarAutoSync) // E: update Google Calendars after task changes
    router.use('/families/:familyId/tasks', tasks)
    router.use('/families/:familyId/assistant', assistant)
    router.use('/families/:familyId/transit', familyTransit) // E: live banner
    router.use('/families/:familyId/logs', logs)
    router.use('/families/:familyId/notifications', notifications) // F (add when built)
    router.use('/families/:familyId/notify-settings', notifySettings)
    router.use('/families/:familyId/search', search)          // D: tasks, care log, people and places

    export default router
