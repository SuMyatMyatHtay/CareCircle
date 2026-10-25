import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from '../../server/node_modules/jsonwebtoken/index.js'
import { getConnectUrl, getStatus, oauthCallback } from '../../server/src/features/calendar-sync/controller.js'

const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'JWT_SECRET']
let saved
beforeEach(t => {
  saved = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  Object.assign(process.env, { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-only-secret',
    GOOGLE_REDIRECT_URI: 'http://app.example.test/api/google/callback', JWT_SECRET: 'calendar-test-secret' })
  t.mock.method(console, 'error', () => {})
})
afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})
function response() {
  const result = { statusCode: 200 }
  return Object.assign(result, { status(code) { result.statusCode = code; return this },
    json(body) { result.body = body; return this }, redirect(url) { result.location = url; return this } })
}

test('calendar connection URL contains expiring user-bound state and no client secret', () => {
  const res = response()
  getConnectUrl({ user: { userId: 'alex' } }, res)
  const url = new URL(res.body.url)
  assert.equal(url.origin, 'https://accounts.google.com')
  const state = jwt.verify(url.searchParams.get('state'), process.env.JWT_SECRET)
  assert.equal(state.userId, 'alex')
  assert.equal(state.purpose, 'google-calendar')
  assert.equal(state.exp - state.iat, 600)
  assert.ok(!res.body.url.includes(process.env.GOOGLE_CLIENT_SECRET))
})

test('unconfigured calendar status and connect fail safely without a database or provider', async t => {
  delete process.env.GOOGLE_CLIENT_ID
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No provider call expected') })
  const status = response(), connect = response()
  await getStatus({ user: { userId: 'alex' } }, status)
  getConnectUrl({ user: { userId: 'alex' } }, connect)
  assert.deepEqual(status.body, { available: false, connected: false })
  assert.equal(connect.statusCode, 503)
  assert.equal(fetch.mock.callCount(), 0)
})

test('unconfigured public callback returns 503 even when the redirect URL is absent', async t => {
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_REDIRECT_URI
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No provider call expected') })
  const res = response()
  await oauthCallback({ query: {} }, res)
  assert.equal(res.statusCode, 503)
  assert.equal(fetch.mock.callCount(), 0)
})

for (const kind of ['tampered', 'expired', 'wrong-purpose']) {
  test(`calendar callback rejects ${kind} state before exchanging a code`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No provider call expected') })
    const state = kind === 'tampered' ? 'forged-token' : jwt.sign({ userId: 'alex',
      purpose: kind === 'wrong-purpose' ? 'login' : 'google-calendar' }, process.env.JWT_SECRET,
    { expiresIn: kind === 'expired' ? -1 : 600 })
    const res = response()
    await oauthCallback({ query: { state, code: 'unused-test-code' } }, res)
    assert.equal(new URL(res.location).searchParams.get('calendar'), 'error')
    assert.equal(fetch.mock.callCount(), 0)
  })
}

test('cancelled calendar consent does not exchange codes or write a link', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No provider call expected') })
  const res = response()
  await oauthCallback({ query: { error: 'access_denied' } }, res)
  assert.equal(new URL(res.location).searchParams.get('calendar'), 'cancelled')
  assert.equal(fetch.mock.callCount(), 0)
})
