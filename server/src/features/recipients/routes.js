// Owner: Jhen (C)
import { Router } from 'express'
const router = Router()
// These endpoints are placeholders; they do not yet implement business logic.
router.get('/', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'recipients' }))
router.post('/', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'recipients' }))
router.get('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'recipients' }))
router.patch('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'recipients' }))
export default router
