// Owner: SeungHak (F)
import { Router } from 'express'
import { listLogs, createLog, getLog, updateLog, deleteLog } from './controller.js'

const router = Router()

router.get('/', listLogs)
router.post('/', createLog)
router.get('/:logId', getLog)
router.patch('/:logId', updateLog)
router.delete('/:logId', deleteLog)

export default router
