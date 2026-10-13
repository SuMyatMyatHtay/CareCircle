// Owner: Chaithra (E)
// Mounted at /api/me in routes/index.js. Not tied to one family, so only requireAuth.
import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { getMyTasks } from './controller.js'

const router = Router()

router.get('/tasks', requireAuth, getMyTasks)   // ?status=&from=&to=

export default router
