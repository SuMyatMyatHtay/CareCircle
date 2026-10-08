import { Router } from 'express'
const router = Router()
// These endpoints are placeholders; they do not yet implement business logic.
router.get('/clinics', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'integrations' }))
router.post('/telegram/notify', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'integrations' }))
export default router
