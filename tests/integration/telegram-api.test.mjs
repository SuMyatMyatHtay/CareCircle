// Owner: SeungHak (F) · Telegram: sending to a family's group, the webhook commands, and the
// reminder route. Real Express routes + an isolated MongoDB; only api.telegram.org is replaced
// by a local double, so no real bot token is used and no message leaves the machine.
import { before, beforeEach, after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../../server/src/app.js'
import { startTestDatabase } from '../../server/test/support/database.js'
import { resetFixtures, ids, accounts, password } from '../../server/test/support/fixtures.js'
import Family from '../../server/src/features/families/Family.model.js'
import Notification from '../../server/src/features/notifications/Notifications.model.js'
import Task from '../../server/src/features/tasks/TaskModel.js'

const OLD_GROUP = '-1001'
const NEW_GROUP = '-1009999' // what Telegram gives the group once it is a supergroup
const SECRET = 'telegram-test-secret'

// Acts like Telegram: a message to the old group id is refused with the group's new id
let telegramCalls = []
function installTelegram() {
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (url.hostname === 'api.telegram.org') {
      const body = JSON.parse(options.body || '{}')
      telegramCalls.push({ method: url.pathname.split('/').pop(), chatId: String(body.chat_id), text: body.text })
      const moved = String(body.chat_id) === OLD_GROUP
      const payload = moved
        ? { ok: false, error_code: 400, description: 'Bad Request: group chat was upgraded to a supergroup chat',
          parameters: { migrate_to_chat_id: Number(NEW_GROUP) } }
        : { ok: true, result: { message_id: 1 } }
      return new Response(JSON.stringify(payload), { status: moved ? 400 : 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.hostname !== '127.0.0.1') throw new Error(`Unexpected external test request: ${url.hostname}`)
    return realFetch(input, options)
  }
  return () => { globalThis.fetch = realFetch }
}

let database, server, base, tokens, restoreFetch
before(async () => {
  database = await startTestDatabase('telegram')
  Object.assign(process.env, { TELEGRAM_BOT_TOKEN: 'telegram-test-token', TELEGRAM_WEBHOOK_SECRET: SECRET, CRON_SECRET: 'cron-test-secret' })
  restoreFetch = installTelegram()
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api`
}, { timeout: 180000 })
after(async () => {
  if (server) {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
  restoreFetch?.()
  for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'CRON_SECRET']) delete process.env[key]
  await database?.stop()
})

async function request(path, { method = 'GET', user = 'alex', body, headers = {}, authenticated = true } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json',
      ...(authenticated && tokens?.[user] ? { Authorization: `Bearer ${tokens[user]}` } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, data: response.status === 204 ? null : await response.json().catch(() => null) }
}

// What Telegram posts to the webhook
const webhook = (message, secret = SECRET) => request('/integrations/telegram/webhook', {
  method: 'POST', authenticated: false, body: { update_id: 1, message },
  headers: secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {},
})
const group = (id) => ({ id: Number(id), type: 'supergroup', title: 'Tan family chat' })
const chatIdOf = async () => (await Family.findById(ids.family).lean()).telegram?.chatId

beforeEach(async () => {
  await resetFixtures()
  telegramCalls = []
  tokens = {}
  for (const [name, email] of Object.entries(accounts)) {
    tokens[name] = (await request('/auth/login', { method: 'POST', authenticated: false, body: { email, password } })).data.token
  }
})

describe('Telegram group, webhook and reminders', () => {
  it('follows a group that became a supergroup, so updates keep arriving without /link again', async () => {
    await Family.updateOne({ _id: ids.family }, { $set: { telegram: { chatId: OLD_GROUP } } })
    const startAt = new Date(Date.now() + 3600e3).toISOString()
    assert.equal((await request(`/families/${ids.family}/tasks`, { method: 'POST', body: { title: 'Buy medicine', category: 'errand', startAt } })).status, 201)

    // Refused at the old id, then sent to the new one, which is now saved
    assert.deepEqual(telegramCalls.map(call => call.chatId), [OLD_GROUP, NEW_GROUP])
    assert.equal(await chatIdOf(), NEW_GROUP)
    assert.equal((await Notification.findOne({ family: ids.family }).lean()).status, 'sent')

    // Later messages go straight to the new id
    telegramCalls = []
    assert.equal((await request(`/families/${ids.family}/notify-settings/test`, { method: 'POST' })).status, 200)
    assert.deepEqual(telegramCalls.map(call => call.chatId), [NEW_GROUP])
  })

  it('"Send test message" also follows a moved group', async () => {
    await Family.updateOne({ _id: ids.family }, { $set: { telegram: { chatId: OLD_GROUP } } })
    const result = await request(`/families/${ids.family}/notify-settings/test`, { method: 'POST' })
    assert.equal(result.status, 200)
    assert.equal(await chatIdOf(), NEW_GROUP)
  })

  it('links, follows and unlinks a group through the webhook, and refuses a wrong secret', async () => {
    assert.equal((await webhook({ chat: group('-555'), text: '/link AABBCCDDEE' }, 'wrong')).status, 401)
    assert.equal((await webhook({ chat: group('-555'), text: '/link AABBCCDDEE' }, '')).status, 401)
    assert.equal(await chatIdOf(), undefined)

    assert.equal((await webhook({ chat: group('-555'), from: { username: 'nobody' }, text: '/link AABBCCDDEE' })).status, 200)
    assert.equal(await chatIdOf(), '-555')
    assert.match(telegramCalls.at(-1).text, /^Linked to Tan family/)

    // Telegram announces the move in the old group and in the new supergroup
    await webhook({ chat: group('-555'), migrate_to_chat_id: -100777 })
    assert.equal(await chatIdOf(), '-100777')
    await webhook({ chat: group('-100888'), migrate_from_chat_id: -100777 })
    assert.equal(await chatIdOf(), '-100888')

    await webhook({ chat: group('-100888'), text: '/unlink' })
    assert.equal(await chatIdOf(), undefined)
  })

  it('runs scheduled reminders only for the cron service', async () => {
    const run = (authorization) => request('/cron/reminders', { method: 'POST', authenticated: false,
      headers: authorization ? { Authorization: authorization } : {} })
    assert.equal((await run()).status, 401)
    assert.equal((await run('Bearer wrong')).status, 401)
    const ok = await run('Bearer cron-test-secret')
    assert.equal(ok.status, 200)
    assert.deepEqual(ok.data, { ok: true })
    // The old duplicate route is gone
    assert.equal((await request('/integrations/reminders', { method: 'POST', authenticated: false })).status, 404)
  })

  it('sends just the message, with no link back to the app', async () => {
    process.env.APP_URL = 'https://app.example.test'
    try {
      await Family.updateOne({ _id: ids.family }, { $set: { telegram: { chatId: NEW_GROUP } } })
      const startAt = new Date(Date.now() + 3600e3).toISOString()
      await request(`/families/${ids.family}/tasks`, { method: 'POST', body: { title: 'Buy medicine', category: 'errand', startAt } })
      assert.equal(telegramCalls.length, 1)
      assert.doesNotMatch(telegramCalls[0].text, /https?:\/\//)
      assert.match(telegramCalls[0].text, /^New task: Buy medicine/)
    } finally {
      delete process.env.APP_URL
    }
  })

  it('sends the 24-hour "still unclaimed" reminder only where it is switched on, and once', async () => {
    // Two linked families, each with an unclaimed task starting in 3 hours (inside the 24-hour window)
    await Family.updateOne({ _id: ids.family }, { $set: { telegram: { chatId: NEW_GROUP }, reminders: { unclaimedTask: true } } })
    await Family.updateOne({ _id: ids.otherFamily }, { $set: { telegram: { chatId: '-1002' }, reminders: { unclaimedTask: false } } })
    const startAt = new Date(Date.now() + 3 * 3600e3)
    const tan = await Task.create({ family: ids.family, title: 'Pharmacy run', category: 'errand', startAt, createdBy: ids.alex })
    await Task.create({ family: ids.otherFamily, title: 'Lee errand', category: 'errand', startAt, createdBy: ids.outsider })

    const run = await request('/cron/reminders', { method: 'POST', authenticated: false, headers: { Authorization: 'Bearer cron-test-secret' } })
    assert.equal(run.status, 200)
    // Only the family that switched it on hears about it
    assert.deepEqual(telegramCalls.map(call => call.chatId), [NEW_GROUP])
    assert.match(telegramCalls[0].text, /Pharmacy run/)
    // The task is marked, so later sweeps don't repeat it
    assert.ok((await Task.findById(tan._id).lean()).unclaimedReminderAt)
  })
})
