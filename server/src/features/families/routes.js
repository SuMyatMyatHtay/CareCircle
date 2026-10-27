// Owner: Sera (A); members and settings: SangYoon (B)
// Only family-level routes live here. Feature routes (tasks, recipients,
// logs, transit) are mounted in routes/index.js.
import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { requireFamilyMember, requireFamilyAdmin } from '../../middleware/requireFamilyMember.js'
import { createFamily, getMyFamilies, joinFamily } from './controller.js'
import { listMembers, updateMember, deleteMember, regenerateInviteCode } from './settings.controller.js'

const router = Router()

// All family routes require authentication
router.use(requireAuth)

// Shorthands so every route below states its access level in one word
const member = [requireAuth, requireFamilyMember]
const admin = [requireAuth, requireFamilyMember, requireFamilyAdmin]

// ---- A (Sera): logged in, not tied to one family ----
router.get('/mine', getMyFamilies)      // Get the logged-in user's families
router.post('/', createFamily)          // Create a new family
router.post('/join', joinFamily)


// ---- B (SangYoon): settings and members ----
router.post('/:familyId/invite-code', admin, regenerateInviteCode)
router.get('/:familyId/members', member, listMembers)
router.patch('/:familyId/members/:userId', admin, updateMember) // { role }; existing schema has no relationship field
router.delete('/:familyId/members/:userId', member, deleteMember)

export default router
