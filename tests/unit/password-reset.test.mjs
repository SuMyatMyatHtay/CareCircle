import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from '../../server/node_modules/bcryptjs/index.js'
import User from '../../server/src/features/auth/User.model.js'
import { passwordResetHandlers, resetRateLimit, sendResetEmail } from '../../server/src/features/auth/password-reset.js'

let user, mail, handlers
const clone = value => value == null ? value : structuredClone(value)
const get = (obj, path) => path.split('.').reduce((item, key) => item?.[key], obj)
function set(obj, path, value) {
  const parts = path.split('.'), last = parts.pop()
  for (const part of parts) obj = obj[part] ||= {}
  obj[last] = value
}
function matches(filter) {
  return user && Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(matches)
    const actual = get(user, key)
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('$exists' in value) return (actual !== undefined) === value.$exists
      if ('$lte' in value) return actual <= value.$lte
      if ('$gt' in value) return actual > value.$gt
    }
    return actual instanceof Date ? +actual === +value : actual === value
  })
}
function update(filter, operation) {
  if (!matches(filter)) return null
  for (const [key, value] of Object.entries(operation.$set || {})) set(user, key, clone(value))
  for (const [key, value] of Object.entries(operation.$inc || {})) set(user, key, (get(user, key) || 0) + value)
  for (const key of Object.keys(operation.$unset || {})) {
    const parts = key.split('.'), last = parts.pop()
    delete parts.reduce((obj, part) => obj[part], user)[last]
  }
  return clone(user)
}
async function invoke(handler, body) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(data) { this.body = data; return this } }
  await handler({ body }, res)
  return res
}
const requestCode = (email = 'alex@example.com') => invoke(handlers.requestCode, { email })
const verify = (code = mail.at(-1)?.code) => invoke(handlers.verifyCode, { email: 'alex@example.com', code })
const finish = resetToken => invoke(handlers.resetPassword, { email: 'alex@example.com', resetToken, password: 'new-password-123', confirmPassword: 'new-password-123' })
const reset = async (code = mail.at(-1)?.code) => {
  const verified = await verify(code)
  return verified.statusCode === 200 ? finish(verified.body.resetToken) : verified
}

beforeEach(t => {
  for (const [key, value] of Object.entries({ JWT_SECRET: 'reset-test-secret', RESEND_API_KEY: 'test-key', PASSWORD_RESET_FROM: 'CareCircle <care@example.com>' })) {
    const old = process.env[key]; process.env[key] = value
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old })
  }
  user = { _id: 'alex', email: 'alex@example.com', passwordHash: 'old-hash', tokenVersion: 2 }
  mail = []
  handlers = passwordResetHandlers({ deliver: async (email, code) => mail.push({ email, code }) })
  t.mock.method(User, 'findOneAndUpdate', (filter, operation) => {
    const result = update(filter, operation)
    return { then: resolve => Promise.resolve(result).then(resolve), select: async () => result }
  })
  t.mock.method(User, 'exists', async filter => matches(filter))
  t.mock.method(User, 'updateOne', async (filter, operation) => ({ modifiedCount: update(filter, operation) ? 1 : 0 }))
})

test('sends an expiring code, stores only a digest, and hides unknown accounts', async () => {
  const known = await requestCode(' ALEX@EXAMPLE.COM ')
  const unknown = await requestCode('unknown@example.com')
  assert.equal(known.statusCode, 200)
  assert.deepEqual(known.body, unknown.body)
  assert.equal(mail.length, 1)
  assert.match(mail[0].code, /^\d{6}$/)
  assert.notEqual(user.passwordReset.hash, mail[0].code)
  assert.equal(user.passwordReset.attempts, 5)
  assert.equal(+user.passwordReset.expiresAt - +user.passwordReset.sentAt, 600000)
  assert.equal(JSON.stringify(known.body).includes(mail[0].code), false)
})

test('cooldown prevents resending and a new code replaces the old digest', async () => {
  await requestCode(); const hash = user.passwordReset.hash
  await requestCode(); assert.equal(mail.length, 1)
  user.passwordReset.sentAt = new Date(Date.now() - 61000)
  await requestCode(); assert.equal(mail.length, 2)
  assert.notEqual(user.passwordReset.hash, hash)
})

test('five wrong codes lock out even the correct code', async () => {
  await requestCode()
  const wrong = mail[0].code === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) assert.equal((await reset(wrong)).statusCode, 400)
  assert.equal((await reset()).statusCode, 400)
  assert.equal(user.passwordHash, 'old-hash')
})

test('expired codes and unknown accounts cannot reset a password', async () => {
  await requestCode(); user.passwordReset.expiresAt = new Date(Date.now() - 1)
  assert.equal((await reset()).statusCode, 400)
  user = null
  assert.equal((await reset()).statusCode, 400)
})

test('successful reset hashes the password, revokes sessions and disallows replay', async () => {
  await requestCode()
  assert.equal((await reset()).statusCode, 200)
  assert.equal(await bcrypt.compare('new-password-123', user.passwordHash), true)
  assert.equal(user.tokenVersion, 3)
  assert.equal(user.passwordReset.hash, undefined)
  assert.equal((await reset()).statusCode, 400)
})

test('concurrent correct resets consume a code only once', async () => {
  await requestCode()
  const results = await Promise.all([reset(), reset()])
  assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 400])
  assert.equal(user.tokenVersion, 3)
})

test('invalid inputs and missing email configuration are rejected', async () => {
  assert.equal((await requestCode({ $ne: null })).statusCode, 400)
  assert.equal((await invoke(handlers.resetPassword, { email: 'alex@example.com', code: '123456', password: 'short', confirmPassword: 'short' })).statusCode, 400)
  delete process.env.RESEND_API_KEY
  assert.equal((await requestCode()).statusCode, 503)
  assert.equal(mail.length, 0)
})

test('IP limit stops repeated requests', () => {
  const limit = resetRateLimit()
  let passed = 0, status
  const res = { status(value) { status = value; return this }, json() {} }
  for (let i = 0; i < 31; i++) limit({ ip: '127.0.0.1' }, res, () => passed++)
  assert.equal(passed, 30); assert.equal(status, 429)
})

test('email adapter sends only to Resend and handles provider failures', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails')
    assert.equal(options.headers.Authorization, 'Bearer test-key')
    const body = JSON.parse(options.body)
    assert.deepEqual(body.to, ['alex@example.com'])
    assert.ok(body.text.includes('012345'))
    return { ok: false, status: 403, json: async () => ({ name: 'validation_error' }) }
  })
  await assert.rejects(sendResetEmail('alex@example.com', '012345'), /delivery failed/)
})


test('OTP verification does not change the password; reset requires its single-use token', async () => {
  await requestCode()
  assert.equal((await finish('a'.repeat(64))).statusCode, 400)
  const result = await verify()
  assert.equal(result.statusCode, 200)
  assert.equal(user.passwordHash, 'old-hash')
  assert.equal((await verify()).statusCode, 400)
  assert.equal((await finish(result.body.resetToken)).statusCode, 200)
  assert.equal((await finish(result.body.resetToken)).statusCode, 400)
})

test('verified tokens expire and resending invalidates them', async () => {
  await requestCode()
  const result = await verify()
  user.passwordReset.tokenExpiresAt = new Date(Date.now() - 1)
  assert.equal((await finish(result.body.resetToken)).statusCode, 400)
  user.passwordReset.sentAt = new Date(Date.now() - 61000)
  await requestCode()
  assert.equal(user.passwordReset.tokenHash, undefined)
  assert.equal((await finish(result.body.resetToken)).statusCode, 400)
})
