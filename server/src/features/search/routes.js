// Owner: Marcus (D)
// Mounted at /api/families/:familyId/search in routes/index.js, after
// requireAuth + requireFamilyMember, so every search is scoped to req.family.
import { Router } from 'express'
import { searchFamily } from './controller.js'

const router = Router()

router.get('/', searchFamily) // ?q=&type=&recipient=&when=&status=&sort=&limit=

export default router
