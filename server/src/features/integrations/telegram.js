// POST /api/integrations/telegram/webhook (what happens when someone types in the family group).
// Webhook commands:
//   /link <inviteCode>   run in the family's group: connects the group to the family
//   /start <inviteCode>  the same, sent by Telegram itself when the bot is added through
//                        the "Add to Telegram" button (t.me/<bot>?startgroup=<inviteCode>)
//   /unlink              run in a linked group: disconnects it
//   /start, /help        short instructions
import { timingSafeEqual } from 'node:crypto'
import Family from '../families/Family.model.js'
import User from '../auth/User.model.js'
 
const API = 'https://api.telegram.org'
const GROUP_TYPES = ['group', 'supergroup']
 
// ---------------------------------------------------------------- Bot API
export async function callTelegram(method, body = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')
 
  const response = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000), // serverless: don't let a slow Telegram hold the request open
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) {
    const error = new Error(data.description || `Telegram HTTP ${response.status}`)
    // "group chat was upgraded to a supergroup chat": Telegram also says the group's new id
    if (data.parameters?.migrate_to_chat_id) error.migrateTo = String(data.parameters.migrate_to_chat_id)
    throw error
  }
  return data.result
}
 
// Plain text on purpose (no parse_mode): names and titles can't break the formatting
export function sendTelegramMessage(chatId, text) {
  return callTelegram('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } })
}
 
// A group that becomes a supergroup (e.g. after its settings change) gets a new id.
// Point every family linked to the old id at the new one.
export async function moveGroup(oldChatId, newChatId) {
  await Family.updateMany({ 'telegram.chatId': String(oldChatId) }, { $set: { 'telegram.chatId': String(newChatId) } })
}

// Send to a family's linked group. If the group moved to a new id, remember it and send
// again, so nobody has to /link the group again. Use this for every message to a family.
export async function sendToGroup(chatId, text) {
  try {
    return await sendTelegramMessage(chatId, text)
  } catch (error) {
    if (!error.migrateTo) throw error
    await moveGroup(chatId, error.migrateTo)
    return sendTelegramMessage(error.migrateTo, text)
  }
}

// Telegram sends the secret we gave setWebhook in this header on every update
function isValidWebhookSecret(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return false // refuse everything until a secret is configured
  const a = Buffer.from(String(req.get('x-telegram-bot-api-secret-token') || ''))
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
 
// ---------------------------------------------------------------- Webhook
const HELP = [
  'Hi! I send CareCircle updates to your family group.',
  'In CareCircle, open Family settings and tap "Add to Telegram group", then pick your group.',
  'Or add me to the group yourself and send: /link YOURCODE',
].join('\n')
 
async function reply(chatId, text) {
  try {
    await sendTelegramMessage(chatId, text)
  } catch (error) {
    console.error('Telegram reply failed:', error.message)
  }
}
 
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
 
// Match the Telegram username to a family member, so we can record who linked the group
async function findLinker(family, username) {
  if (!username) return null
  return User.findOne({
    _id: { $in: family.members.map((member) => member.userId) },
    telegramUsername: new RegExp(`^@?${escapeRegex(username)}$`, 'i'),
  }).select('_id')
}
 
async function linkGroup(chat, from, code) {
  if (!GROUP_TYPES.includes(chat.type)) {
    return reply(chat.id, 'Please add me to your family group, then send /link YOURCODE there.')
  }
  const inviteCode = String(code || '').trim().toUpperCase()
  if (!inviteCode) {
    return reply(chat.id, 'Send /link followed by your invite code, for example /link ABC123. You can find it in Family settings.')
  }
  const family = await Family.findOne({ inviteCode }).select('name members')
  if (!family) return reply(chat.id, "I couldn't find that invite code. Check Family settings and try again.")
 
  const linker = await findLinker(family, from?.username)
  const chatId = String(chat.id)
 
  // One group belongs to one family, otherwise two families' updates would mix in one chat
  await Family.updateMany({ 'telegram.chatId': chatId, _id: { $ne: family._id } }, { $set: { telegram: {} } })
  await Family.updateOne(
    { _id: family._id },
    { $set: { telegram: { chatId, linkedBy: linker?._id ?? null, linkedAt: new Date() } } },
  )
  return reply(chat.id, `Linked to ${family.name}. I'll post task and care updates here.`)
}
 
async function unlinkGroup(chat) {
  const result = await Family.updateOne({ 'telegram.chatId': String(chat.id) }, { $set: { telegram: {} } })
  return reply(chat.id, result.modifiedCount
    ? 'Unlinked. This group will no longer get CareCircle updates.'
    : 'This group is not linked to a family.')
}
 
async function handleUpdate(update) {
  const message = update?.message
  if (!message?.chat) return
  // The group became a supergroup: Telegram posts this in the old group and the new one
  if (message.migrate_to_chat_id) return moveGroup(message.chat.id, message.migrate_to_chat_id)
  if (message.migrate_from_chat_id) return moveGroup(message.migrate_from_chat_id, message.chat.id)
  if (!message.text) return
  const [first, ...rest] = message.text.trim().split(/\s+/)
  const command = first.toLowerCase().replace(/@.*$/, '') // "/link@CareCircleBot" -> "/link"
  if (command === '/link') return linkGroup(message.chat, message.from, rest[0])
  if (command === '/unlink') return unlinkGroup(message.chat)
  // The "Add to Telegram group" button: Telegram sends "/start@Bot CODE" in the chosen group
  if (command === '/start' && rest[0]) return linkGroup(message.chat, message.from, rest[0])
  if (command === '/start' || command === '/help') return reply(message.chat.id, HELP)
}
 
export async function telegramWebhook(req, res) {
  if (!isValidWebhookSecret(req)) return res.status(401).json({ error: 'Invalid secret token' })
  try {
    await handleUpdate(req.body)
  } catch (error) {
    // Always answer 200, otherwise Telegram keeps retrying the same update
    console.error('Telegram webhook error:', error.message)
  }
  return res.json({ ok: true })
}
 