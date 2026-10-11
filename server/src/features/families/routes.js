// Owner: Sera (A); members and settings: SangYoon (B)
// Only family-level routes live here. Feature routes (tasks, recipients,
// logs, transit) are mounted in routes/index.js.
import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { requireFamilyMember, requireFamilyAdmin } from '../../middleware/requireFamilyMember.js'

const router = Router()

// Placeholder until the controller functions exist. Replace each one with
// the real handler from ./controller.js, e.g. listMyFamilies, createFamily.
const notImplemented = (_req, res) =>
  res.status(501).json({ error: 'Not implemented', module: 'families' })

// Shorthands so every route below states its access level in one word
const member = [requireAuth, requireFamilyMember]
const admin = [requireAuth, requireFamilyMember, requireFamilyAdmin]

// ---- A (Sera): logged in, not tied to one family ----
router.get('/', requireAuth, notImplemented)          // my families (family switcher)
router.post('/', requireAuth, notImplemented)         // create a family; creator becomes admin
router.post('/join', requireAuth, notImplemented)     // { inviteCode, relationship? }

// ---- A (Sera): one family ----
router.get('/:familyId', member, notImplemented)      // family details + members

// ---- B (SangYoon): settings and members ----
router.patch('/:familyId', admin, notImplemented)                 // { name }
router.post('/:familyId/invite-code', admin, notImplemented)      // new code; old one stops working
router.get('/:familyId/members', member, notImplemented)
router.patch('/:familyId/members/:userId', admin, notImplemented) // { role?, relationship? }
router.delete('/:familyId/members/:userId', member, notImplemented) // admin, or yourself leaving: check in controller

export default router