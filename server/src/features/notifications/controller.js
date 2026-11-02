// Handlers for /api/families/:familyId/notifications and /api/families/:familyId/notify-settings.
// See docs/API-CONTRACT.md (section F). The notify() function other packages call is in utils/notify.js.

// requireAuth + requireFamilyMember run before every handler, so these are always set:
//   req.user.userId, req.family, req.memberRole
import mongoose from 'mongoose'
import Family from '../families/Family.model.js'
import User from '../auth/User.model.js'
import Notification from './Notifications.model.js'
import { effectiveEvents, parseNotifyOn } from '../../utils/notify.js'
import { sendTelegramMessage } from '../integrations/telegram.js'
import { NOTIFICATION_STATUSES } from '../../constants.js'

// GET /api/families/:familyId/notifications?limit=20&status=sent
// Newest first. Feeds "Recent updates" on Family Home.
export async function listNotifications(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50)
    const filter = { family: req.family._id }
    if (req.query.status !== undefined) {
      if (!NOTIFICATION_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ error: 'Validation failed', errors: [`Status must be one of: ${NOTIFICATION_STATUSES.join(', ')}`] })
      }
      filter.status = req.query.status
    }
    // Telegram error text is for admins only
    const fields = req.memberRole === 'admin'
      ? 'eventType refType refId text status error sentAt createdAt'
      : 'eventType refType refId text status sentAt createdAt'
    const notifications = await Notification.find(filter).select(fields).sort({ createdAt: -1 }).limit(limit).lean()
    return res.json({ notifications })
  } catch (error) {
    return next(error)
  }
}

// GET /api/families/:familyId/notify-settings   (any member)
// The chat id is never sent to the browser.
export async function getNotifySettings(req, res, next) {
  try {
    const telegram = req.family.telegram || {}
    const linked = Boolean(telegram.chatId)
    let linkedBy = null
    if (linked && mongoose.isValidObjectId(telegram.linkedBy)) {
      const user = await User.findById(telegram.linkedBy).select('name')
      if (user) linkedBy = { _id: user._id.toString(), name: user.name }
    }
    return res.json({
      notifyOn: effectiveEvents(req.family.notifyOn),
      telegram: { linked, linkedAt: linked ? telegram.linkedAt || null : null, linkedBy },
      botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
      reminders: reminderFlags(req.family)
    })
  } catch (error) {
    return next(error)
  }
}

// PATCH /api/families/:familyId/notify-settings   (admin)   { notifyOn: [eventType] }
export async function updateNotifySettings(req, res, next) {
  try {
    const set = {}
    if (req.body?.notifyOn !== undefined || req.body?.reminders === undefined) {
      const parsed = parseNotifyOn(req.body?.notifyOn)
      if (parsed.error) return res.status(400).json({ error: 'Validation failed', errors: [parsed.error] })
      set.notifyOn = parsed.value
    }
    const reminders = req.body?.reminders
    if (reminders !== undefined) {
      const bad = !reminders || typeof reminders !== 'object' ||
        Object.entries(reminders).some(([k, v]) => !['beforeTask', 'unclaimedTask','dailySummary'].includes(k) || typeof v !== 'boolean')
      if (bad) return res.status(400).json({ error: 'Validation failed', errors: ['reminders must be { beforeTask, dailySummary } true or false'] })
      for (const [k, v] of Object.entries(reminders)) set[`reminders.${k}`] = v
    }
    const family = await Family.findOneAndUpdate({ _id: req.family._id }, { $set: set }, { new: true })
    if (!family) return res.status(404).json({ error: 'Family not found' })
    return res.json({ notifyOn: effectiveEvents(family.notifyOn), reminders: reminderFlags(family) })
  } catch (error) {
    return next(error)
  }
}

// POST /api/families/:familyId/notify-settings/test   (admin)
// One harmless message, so an admin can check the group is connected.
export async function sendTestMessage(req, res, next) {
  try {
    const chatId = req.family.telegram?.chatId
    if (!chatId) return res.status(409).json({ error: 'No Telegram group is linked yet' })
    try {
      await sendTelegramMessage(chatId, `CareCircle test: updates for ${req.family.name} will appear in this group.`)
    } catch (error) {
      console.error('Telegram test message failed:', error.message)
      return res.status(502).json({ error: 'Telegram did not accept the message. Is the bot still in the group?' })
    }
    return res.json({ ok: true })
  } catch (error) {
    return next(error)
  }
}

// DELETE /api/families/:familyId/notify-settings/telegram   (admin)
export async function unlinkTelegram(req, res, next) {
  try {
    await Family.updateOne({ _id: req.family._id }, { $set: { telegram: {} } })
    return res.status(204).end()
  } catch (error) {
    return next(error)
  }
}

const reminderFlags = (family) => ({
  beforeTask: family.reminders?.beforeTask === true,
  unclaimedTask: family.reminders?.unclaimedTask === true,
  dailySummary: family.reminders?.dailySummary === true
})