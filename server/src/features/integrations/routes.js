// Owner: SeungHak (F)
import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { searchClinics } from './onemap.js'
import { readAudio, transcribe } from './speech.js'
const router = Router()
// These endpoints are placeholders; they do not yet implement business logic.
router.get('/clinics', requireAuth, searchClinics) // E (Chaithra): OneMap search, ?q=
router.post('/transcribe', requireAuth, readAudio, transcribe) // F (SeungHak): Groq speech-to-text
router.post('/telegram/notify', (_req, res) => res.status(501).json({ error: 'Not implemented', module: 'integrations' }))
export default router
