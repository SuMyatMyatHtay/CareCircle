
import { Router } from 'express'
import { login, getCurrentUser } from './controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

// Public
router.post('/login', login)

// Protected
router.get('/me', requireAuth, getCurrentUser)

export default router
