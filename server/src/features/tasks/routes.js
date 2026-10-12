// Owner: Marcus (D)
// Mounted at /api/families/:familyId/tasks in routes/index.js, after
// requireAuth + requireFamilyMember. Role checks (creator, claimer, admin)
// happen in the controller because they depend on the task.
import { Router } from 'express'
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  claimTask,
  unclaimTask,
  startTask,
  completeTaskHandler,
  cancelTask
} from './controller.js'

const router = Router()

router.get('/', listTasks)                          // ?status=&recipient=&claimedBy=&from=&to=
router.post('/', createTask)                        // member
router.get('/:taskId', getTask)                     // member
router.patch('/:taskId', updateTask)                // creator or admin
router.delete('/:taskId', deleteTask)               // creator or admin

// ---- Status changes ----
router.post('/:taskId/claim', claimTask)            // member: open -> claimed
router.post('/:taskId/unclaim', unclaimTask)        // claimer or admin: claimed -> open
router.post('/:taskId/start', startTask)            // claimer: claimed -> in_progress
router.post('/:taskId/complete', completeTaskHandler) // claimer: claimed/in_progress -> completed
router.post('/:taskId/cancel', cancelTask)          // creator or admin: -> cancelled

export default router
