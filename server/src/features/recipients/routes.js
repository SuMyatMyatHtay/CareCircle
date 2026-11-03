// Owner: Jhen (C)
// Mounted at /api/families/:familyId/recipients in routes/index.js, after
// requireAuth + requireFamilyMember. Recipients are archived, never deleted,
// so there is no DELETE route.
import { Router } from 'express'
import { canRemoveRecipient } from '../tasks/permissions.js'
import {
    listRecipients,
    getRecipient,
    createRecipient,
    updateRecipient,
    archiveRecipient
} from './controller.js'

const router = Router()

router.get('/', listRecipients)                     // member, ?includeArchived=true
router.post('/', createRecipient)                   // member
router.get('/:recipientId', getRecipient)           // member
router.patch('/:recipientId', updateRecipient)      // member

router.post('/:recipientId/archive', (req, res, next) => {
    if (!canRemoveRecipient(req.family, req.user.userId)) return res.status(403).json({ error: 'Only family admins can remove recipients with the current family setting.' })
    next()
}, archiveRecipient)

export default router
