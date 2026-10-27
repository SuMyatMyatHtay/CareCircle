import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeContributions, contributionPoints } from '../../client/src/features/contributions/analytics.js'

const members = ['a', 'b', 'c'].map(id => ({ user: { _id: id, name: id } }))
const task = (changes = {}) => ({ family: 'family-a', status: 'completed', claimedBy: { _id: 'a', name: 'a' }, completedAt: '2026-10-27T01:00:00Z', ...changes })
const now = new Date('2026-10-27T08:00:00Z')

test('isolates families and counts only recorded completions; includes zero contributors', () => {
  const stats = analyzeContributions([task(), task({ family: 'family-b' }), task({ status: 'claimed' }), task({ completedAt: null }), task({ completedAt: '2026-10-28T01:00:00Z' })], members, 'family-a', 'month', now)
  assert.equal(stats.total, 1)
  assert.deepEqual(stats.rows.map(r => r.count), [1, 0, 0])
  assert.equal(stats.rows[0].share, 100)
})
test('awards bonuses only for valid claim times and appointments with transit', () => {
  const fields = { category: 'appointment', needsTransit: true, createdAt: '2026-10-26T00:00:00Z', claimedAt: '2026-10-26T01:00:00Z' }
  assert.equal(contributionPoints(fields), 3)
  assert.equal(contributionPoints({ ...fields, claimedAt: '2026-10-25T23:00:00Z' }), 2)
  assert.equal(contributionPoints({}), 1)
})
test('uses Singapore month and Monday week boundaries', () => {
  const tasks = [task({ completedAt: '2026-09-30T16:00:00Z' }), task({ completedAt: '2026-10-25T16:00:00Z' }), task({ completedAt: '2026-10-25T15:59:59Z' })]
  assert.equal(analyzeContributions(tasks, members, 'family-a', 'month', now).total, 3)
  assert.equal(analyzeContributions(tasks, members, 'family-a', 'week', now).total, 1)
})
test('streaks count distinct days through yesterday and ties receive consecutive ranks', () => {
  const tasks = [task({ completedAt: '2026-10-26T01:00:00Z' }), task({ completedAt: '2026-10-26T02:00:00Z' }), task({ completedAt: '2026-10-25T01:00:00Z' }), ...Array.from({ length: 3 }, () => task({ claimedBy: { _id: 'b', name: 'b' } }))]
  const stats = analyzeContributions(tasks, members, 'family-a', 'all', now)
  assert.equal(stats.rows[0].streak, 2)
  assert.equal(stats.rows[0].rank, 1)
  assert.equal(stats.rows[1].rank, 2)
  assert.equal(stats.rows[2].rank, null)
  assert.equal(analyzeContributions(tasks, members, 'family-a', 'all', new Date('2026-10-29T08:00:00Z')).rows[0].streak, 0)
})
