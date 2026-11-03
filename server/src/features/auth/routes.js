import { Router } from 'express'
import { login, logout, getCurrentUser, updateProfile } from './controller.js'
import { register } from './register.controller.js'
import { updatePet } from './pet.controller.js'
import { updateAvatar } from './avatar.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'
import { getPublicProfile } from './public-profile.controller.js'
import { passwordResetHandlers, resetRateLimit } from './password-reset.js'
const router = Router()
const reset = passwordResetHandlers()
const limitReset = resetRateLimit()
router.post('/forgot-password', limitReset, reset.requestCode)
router.post('/verify-reset-code', limitReset, reset.verifyCode)
router.post('/reset-password', limitReset, reset.resetPassword)
router.post('/register', register)
router.post('/login', login)
router.get('/me', requireAuth, getCurrentUser)
router.get('/users/:userId', requireAuth, getPublicProfile)
router.post('/logout', requireAuth, logout)
router.patch('/me', requireAuth, updateProfile)
router.patch('/me/pet', requireAuth, updatePet)
router.patch('/me/avatar', requireAuth, updateAvatar)
export default router
