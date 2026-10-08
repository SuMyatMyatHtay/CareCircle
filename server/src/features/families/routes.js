import { Router } from 'express'
const router = Router()
// These endpoints are placeholders; they do not yet implement business logic.
router.get('/', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'families' }))
router.post('/', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'families' }))
router.post('/:id/join', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'families' }))
export default router
