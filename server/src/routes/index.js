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
    import assistant from '../features/assistant/routes.js'

    const router = Router()

    // ---- Not tied to one family ----
    router.use('/auth', auth)
    router.use('/integrations', integrations) // Telegram webhook
    // router.use('/users', users)            // B: PATCH /users/me (add when built)
    router.use('/me', me)                     // E: GET /me/tasks

    // Families, members and settings. Guards are set per route inside this router.
    // Must come BEFORE the family guard below, otherwise /families/join
    // would be read as familyId = "join".
    router.use('/families', families)

    // ---- Family guard: every /families/:familyId/<feature> request ----
    router.use('/families/:familyId', requireAuth, requireFamilyMember)

    // ---- Family features ----
    router.use('/families/:familyId/recipients', recipients)
    router.use('/families/:familyId/tasks/:taskId/transit', transit) // must come before /tasks
    router.use('/families/:familyId/tasks', tasks)
    router.use('/families/:familyId/assistant', assistant)
    router.use('/families/:familyId/transit', familyTransit) // E: live banner
    router.use('/families/:familyId/logs', logs)
    // router.use('/families/:familyId/notifications', notifications) // F (add when built)

    export default router
