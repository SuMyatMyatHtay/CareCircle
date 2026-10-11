// Owner: Marcus (D)
import { Router } from 'express'
const router = Router()
// These endpoints are placeholders; they do not yet implement business logic.
router.get('/', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'tasks' }))
router.post('/', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'tasks' }))
router.get('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'tasks' }))
router.patch('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'tasks' }))
router.delete('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'tasks' }))
export default router
