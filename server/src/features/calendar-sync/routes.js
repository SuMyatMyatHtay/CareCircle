// Owner: Chaithra (E)
// Two routers, mounted in routes/index.js:
//   default export  -> /api/me/google        (logged in)
//   googleCallback  -> /api/google/callback  (public: Google sends the browser here)
import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { getStatus, getConnectUrl, oauthCallback, syncNowHandler, disconnect } from './controller.js'

const router = Router()

router.get('/', requireAuth, getStatus)
router.get('/connect', requireAuth, getConnectUrl)
router.post('/sync', requireAuth, syncNowHandler)
router.delete('/', requireAuth, disconnect)

export const googleCallback = Router()
googleCallback.get('/callback', oauthCallback)

export default router
