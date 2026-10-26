import { Router } from 'express'
import { requireFamilyAdmin } from '../../middleware/requireFamilyMember.js'
import {
  listNotifications, getNotifySettings, updateNotifySettings, sendTestMessage, unlinkTelegram,
} from './controller.js'

// /api/families/:familyId/notifications
const router = Router()
router.get('/', listNotifications)

// /api/families/:familyId/notify-settings
export const notifySettings = Router()
notifySettings.get('/', getNotifySettings)
notifySettings.patch('/', requireFamilyAdmin, updateNotifySettings)
notifySettings.post('/test', requireFamilyAdmin, sendTestMessage)
notifySettings.delete('/telegram', requireFamilyAdmin, unlinkTelegram)

export default router