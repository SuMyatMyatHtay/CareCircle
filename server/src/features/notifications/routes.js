import { Router } from 'express'
import { requireFamilyAdmin } from '../../middleware/requireFamilyMember.js'
import {listNotifications, getNotifySettings, updateNotifySettings, sendTestMessage, unlinkTelegram} from './controller.js'
import { runAllDueReminders } from './reminder.js'

// /api/families/:familyId/notifications
const router = Router()
router.get('/', listNotifications)

// /api/families/:familyId/notify-settings
export const notifySettings = Router()
notifySettings.get('/', getNotifySettings)
notifySettings.patch('/', requireFamilyAdmin, updateNotifySettings)
notifySettings.post('/test', requireFamilyAdmin, sendTestMessage)
notifySettings.delete('/telegram', requireFamilyAdmin, unlinkTelegram)

// Called every 5 minutes by cron-job.org with: Authorization: Bearer <CRON_SECRET>
export const cronRoutes = Router()
cronRoutes.post('/reminders', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  await runAllDueReminders()
  return res.json({ ok: true })
})

export default router