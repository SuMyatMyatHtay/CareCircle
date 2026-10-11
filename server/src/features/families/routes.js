import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { createFamily, getMyFamilies } from './controller.js'

const router = Router()

// All family routes require authentication
router.use(requireAuth)

// Get the logged-in user's families
router.get('/mine', getMyFamilies)

// Create a new family
router.post('/', createFamily)

export default router