import { Router } from 'express'
const router = Router()
// These endpoints are placeholders; they do not yet implement business logic.
router.patch('/:id/status', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'journeys' }))
export default router
