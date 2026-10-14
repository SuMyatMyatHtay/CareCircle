// HTTP tests use an in-memory model double; no shared MongoDB data is touched.
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import express from '../../server/node_modules/express/index.js'
import jwt from '../../server/node_modules/jsonwebtoken/index.js'
import Family from '../../server/src/features/families/Family.model.js'
import User from '../../server/src/features/auth/User.model.js'
import familyRoutes from '../../server/src/features/families/routes.js'

const familyId = '000000000000000000000001'
const alex = '000000000000000000000101',
  jasmine = '000000000000000000000102',
  may = '000000000000000000000103',
  outsider = '000000000000000000000104'
const users = Object.fromEntries(
  [
    [alex, 'Alex'],
    [jasmine, 'Jasmine'],
    [may, 'May'],
    [outsider, 'Outsider'],
  ].map(([id, name]) => [
    id,
    {
      _id: id,
      name,
      email: `${name.toLowerCase()}@carecircle.test`,
      preferredLang: 'en',
      tokenVersion: 0,
      passwordHash: 'never-return-this',
    },
  ]),
)
let state, server, base, secretBefore, writeCount
const token = (id) =>
  jwt.sign({ userId: id, tokenVersion: 0 }, 'carecircle-test-only-secret', {
    algorithm: 'HS256',
  })
function memberMatches(member, criteria) {
  return Object.entries(criteria).every(([key, value]) =>
    key === 'userId'
      ? member.userId === String(value)
      : typeof value === 'object'
        ? member[key] !== value.$ne
        : member[key] === value,
  )
}
function matches(filter) {
  if (filter._id && String(filter._id) !== state._id) return false
  if (filter.$and) return filter.$and.every(matches)
  if (filter.$or) return filter.$or.some(matches)
  if (filter.$expr)
    return (
      state.members.filter((member) => member.role === 'admin').length >
      filter.$expr.$gt[1]
    )
  if (filter.members?.$elemMatch)
    return state.members.some((member) =>
      memberMatches(member, filter.members.$elemMatch),
    )
  return true
}
function document(value) {
  if (!value) return null
  const copy = structuredClone(value)
  copy.populate = async function () {
    this.members = this.members.map((member) => ({
      ...member,
      userId: users[member.userId] || null,
    }))
    return this
  }
  return copy
}
function query(execute) {
  let pending
  const once = () => (pending ||= Promise.resolve().then(execute))
  return {
    then: (resolve, reject) => once().then(resolve, reject),
    populate: async () => {
      const doc = await once()
      return doc ? doc.populate() : null
    },
  }
}
async function request(
  path,
  { method = 'GET', userId = alex, body, authenticated = true } = {},
) {
  const response = await fetch(`${base}/families/${familyId}${path}`, {
    method,
    headers: {
      ...(authenticated ? { Authorization: `Bearer ${token(userId)}` } : {}),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  }
}

beforeEach(async (t) => {
  secretBefore = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'carecircle-test-only-secret'
  state = {
    _id: familyId,
    inviteCode: 'AABBCCDDEE',
    members: [
      { userId: alex, role: 'admin' },
      { userId: jasmine, role: 'admin' },
      { userId: may, role: 'member' },
    ],
  }
  writeCount = 0
  t.mock.method(User, 'findById', async (id) => users[id] || null)
  t.mock.method(Family, 'findById', async (id) =>
    String(id) === familyId ? document(state) : null,
  )
  t.mock.method(Family, 'findOneAndUpdate', (filter, update, options) =>
    query(() => {
      writeCount++
      if (!matches(filter)) return null
      if (update.$set?.['members.$[target].role']) {
        const id = String(options.arrayFilters[0]['target.userId'])
        state.members.find((member) => member.userId === id).role =
          update.$set['members.$[target].role']
      }
      if (update.$pull)
        state.members = state.members.filter(
          (member) => member.userId !== update.$pull.members.userId,
        )
      if (update.$set?.inviteCode) state.inviteCode = update.$set.inviteCode
      return document(state)
    }),
  )
  const app = express()
  app.use(express.json())
  app.use('/families', familyRoutes)
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }))
  server = await new Promise((resolve) => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running))
  })
  base = `http://127.0.0.1:${server.address().port}`
})
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
  if (secretBefore === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = secretBefore
})

test('member listing requires authentication and family membership', async () => {
  assert.equal(
    (await request('/members', { authenticated: false })).status,
    401,
  )
  assert.equal((await request('/members', { userId: outsider })).status, 403)
  const result = await request('/members', { userId: may })
  assert.equal(result.status, 200)
  assert.equal(result.data.members.length, 3)
  assert.equal(result.data.members[0].user.name, 'Alex')
  assert.ok(!JSON.stringify(result.data).includes('passwordHash'))
})
test('ordinary members cannot change roles or regenerate invitations', async () => {
  assert.equal(
    (
      await request(`/members/${jasmine}`, {
        method: 'PATCH',
        userId: may,
        body: { role: 'member' },
      })
    ).status,
    403,
  )
  assert.equal(
    (await request('/invite-code', { method: 'POST', userId: may })).status,
    403,
  )
  assert.equal(writeCount, 0)
})
test('invalid roles, extra fields, and cross-family members are rejected', async () => {
  assert.equal(
    (
      await request(`/members/${may}`, {
        method: 'PATCH',
        body: { role: 'owner' },
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await request(`/members/${may}`, {
        method: 'PATCH',
        body: { role: 'admin', userId: outsider },
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await request(`/members/${outsider}`, {
        method: 'PATCH',
        body: { role: 'admin' },
      })
    ).status,
    404,
  )
  assert.equal(
    (await request('/members/not-an-id', { method: 'DELETE' })).status,
    404,
  )
  assert.equal(writeCount, 0)
})
test('admins can change roles; the last admin cannot be demoted or removed', async () => {
  const demotion = await request(`/members/${jasmine}`, {
    method: 'PATCH',
    body: { role: 'member' },
  })
  assert.equal(demotion.status, 200)
  assert.equal(demotion.data.member.role, 'member')
  assert.equal(
    (
      await request(`/members/${alex}`, {
        method: 'PATCH',
        body: { role: 'member' },
      })
    ).status,
    409,
  )
  assert.equal(
    (await request(`/members/${alex}`, { method: 'DELETE' })).status,
    409,
  )
  assert.equal(
    state.members.find((member) => member.userId === alex).role,
    'admin',
  )
})
test('concurrent self-demotions preserve at least one admin', async () => {
  const results = await Promise.all([
    request(`/members/${alex}`, {
      method: 'PATCH',
      userId: alex,
      body: { role: 'member' },
    }),
    request(`/members/${jasmine}`, {
      method: 'PATCH',
      userId: jasmine,
      body: { role: 'member' },
    }),
  ])
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409])
  assert.equal(
    state.members.filter((member) => member.role === 'admin').length,
    1,
  )
})
test('members can leave themselves but cannot remove someone else', async () => {
  assert.equal(
    (await request(`/members/${jasmine}`, { method: 'DELETE', userId: may }))
      .status,
    403,
  )
  assert.equal(
    (await request(`/members/${may}`, { method: 'DELETE', userId: may }))
      .status,
    204,
  )
  assert.ok(!state.members.some((member) => member.userId === may))
})
test('invite regeneration uses the 10-character format supported by Join Family', async () => {
  const oldCode = state.inviteCode
  const result = await request('/invite-code', { method: 'POST' })
  assert.equal(result.status, 200)
  assert.match(result.data.inviteCode, /^[A-F0-9]{10}$/)
  assert.notEqual(result.data.inviteCode, oldCode)
  assert.equal(result.data.inviteCode, state.inviteCode)
})

test('invite regeneration retries unique-code collisions', async (t) => {
  let attempts = 0
  t.mock.method(Family, 'findOneAndUpdate', (_filter, update) =>
    query(() => {
      attempts++
      if (attempts === 1)
        throw Object.assign(new Error('Duplicate invitation'), {
          code: 11000,
          keyPattern: { inviteCode: 1 },
        })
      state.inviteCode = update.$set.inviteCode
      return document(state)
    }),
  )
  const result = await request('/invite-code', { method: 'POST' })
  assert.equal(result.status, 200)
  assert.equal(attempts, 2)
  assert.match(result.data.inviteCode, /^[A-F0-9]{10}$/)
})
