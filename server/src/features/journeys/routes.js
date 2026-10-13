// Owner: Chaithra (E)
// Two routers, both mounted in routes/index.js after requireAuth + requireFamilyMember:
//   default export   -> /api/families/:familyId/tasks/:taskId/transit
//   familyTransit    -> /api/families/:familyId/transit
import { Router } from 'express'
import { getTransitSession, addMilestone, listTransitSessions } from './controller.js'

// mergeParams: without it, req.params.taskId is undefined in here
const router = Router({ mergeParams: true })

router.get('/', getTransitSession)              // member
router.post('/milestones', addMilestone)        // companion only

export const familyTransit = Router({ mergeParams: true })
familyTransit.get('/', listTransitSessions)     // ?status=active

export default router
