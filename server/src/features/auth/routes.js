import { Router } from 'express'
const router = Router()
// These endpoints are placeholders; they do not yet implement business logic.
router.post('/register', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'auth' }))
router.post('/login', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'auth' }))
export default router
