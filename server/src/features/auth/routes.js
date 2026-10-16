import { Router } from 'express'
import { login, logout, getCurrentUser, updateProfile } from './controller.js'
import { register } from './register.controller.js'
import { updatePet } from './pet.controller.js'
import { updateAvatar } from './avatar.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'
const router = Router()
router.post('/register', register)
router.post('/login', login)
router.get('/me', requireAuth, getCurrentUser)
router.post('/logout', requireAuth, logout)
router.patch('/me', requireAuth, updateProfile)
router.patch('/me/pet', requireAuth, updatePet)
router.patch('/me/avatar', requireAuth, updateAvatar)
export default router
