import { updatePet } from './pet.controller.js'
// Owner: Su Myat Myat Htay (Sera)

import { Router } from 'express'
import { login, logout, getCurrentUser, updateProfile } from './controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

// Public
router.post('/login', login)

// Protected
router.get('/me', requireAuth, getCurrentUser)
router.post('/logout', requireAuth, logout)
router.patch('/me', requireAuth, updateProfile)
router.patch('/me/pet', requireAuth, updatePet)

export default router
