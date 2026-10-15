// Owner: SeungHak (F)
// Mounted at /api/families/:familyId/logs in routes/index.js, after
// requireAuth + requireFamilyMember.
import { Router } from 'express'
import { listLogs, createLog, getLog, updateLog, deleteLog } from './controller.js'

const router = Router()

router.get('/', listLogs)              // ?recipient=&before=&limit=
router.post('/', createLog)            // member
router.get('/:logId', getLog)          // member
router.patch('/:logId', updateLog)     // author or admin
router.delete('/:logId', deleteLog)    // author or admin

export default router
