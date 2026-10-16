// Owner: Jhen (C)
// Mounted at /api/families/:familyId/recipients in routes/index.js, after
// requireAuth + requireFamilyMember. Recipients are archived, never deleted,
// so there is no DELETE route.
import { Router } from 'express'
import { requireFamilyAdmin } from '../../middleware/requireFamilyMember.js'
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

router.post('/:recipientId/archive', requireFamilyAdmin, archiveRecipient) // admin

export default router
