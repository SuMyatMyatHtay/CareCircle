import { Router } from 'express'
import auth from '../features/auth/routes.js'
import families from '../features/families/routes.js'
import recipients from '../features/recipients/routes.js'
import tasks from '../features/tasks/routes.js'
import logs from '../features/logs/routes.js'
import journeys from '../features/journeys/routes.js'
import integrations from '../features/integrations/routes.js'
const router = Router()
router.use('/auth', auth)
router.use('/families', families)
router.use('/care-profiles', recipients)
router.use('/tasks', tasks)
router.use('/care-logs', logs)
router.use('/journeys', journeys)
router.use('/integrations', integrations)
export default router
