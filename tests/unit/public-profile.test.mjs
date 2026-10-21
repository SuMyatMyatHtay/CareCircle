import test from 'node:test'
import assert from 'node:assert/strict'
import User from '../../server/src/features/auth/User.model.js'
import Family from '../../server/src/features/families/Family.model.js'
import Task from '../../server/src/features/tasks/TaskModel.js'
import { getPublicProfile } from '../../server/src/features/auth/public-profile.controller.js'

test('public profiles require a shared family and omit private account fields', async (t) => {
  const viewer = '507f1f77bcf86cd799439011'
  const target = '507f1f77bcf86cd799439012'
  let shared = true, queried = false
  t.mock.method(Family, 'find', (query) => {
    assert.equal(query['members.userId'].$all[0], viewer)
    return { select: () => ({ lean: async () => shared ? [{ _id: 'shared-family' }] : [] }) }
  })
  t.mock.method(Task, 'find', (query) => {
    assert.deepEqual(query.family.$in, shared ? ['shared-family'] : [])
    assert.ok([target, viewer].includes(query.claimedBy))
    assert.deepEqual(query.status.$in, ['claimed', 'in_progress', 'completed'])
    return { select: (fields) => {
      assert.equal(fields, 'title status startAt completedAt')
      return { sort: () => ({ limit: (limit) => {
        assert.equal(limit, 3)
        return { lean: async () => [{ title: 'Help with lunch', status: 'completed' }] }
      } }) }
    } }
  })
  t.mock.method(User, 'findById', () => {
    queried = true
    return { select: () => ({ lean: async () => ({
      _id: target, name: 'Grandma', email: 'private@example.com', phone: '123',
      passwordHash: 'secret', tokenVersion: 5, telegramUsername: 'private',
    }) }) }
  })
  const invoke = async (userId) => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
    await getPublicProfile({ params: { userId }, user: { userId: viewer } }, res, (error) => { throw error })
    return res
  }
  const allowed = await invoke(target)
  assert.equal(allowed.statusCode, 200)
  assert.equal(allowed.body.user.name, 'Grandma')
  assert.equal(allowed.body.user.tasks[0].title, 'Help with lunch')
  for (const key of ['email', 'phone', 'passwordHash', 'tokenVersion', 'telegramUsername']) assert.equal(key in allowed.body.user, false)
  shared = false; queried = false
  assert.equal((await invoke(target)).statusCode, 404)
  assert.equal(queried, false)
  assert.equal((await invoke('invalid')).statusCode, 404)
  assert.equal(queried, false)
  assert.equal((await invoke(viewer)).statusCode, 200)
})
