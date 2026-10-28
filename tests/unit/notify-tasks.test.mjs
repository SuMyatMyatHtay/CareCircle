// Owner: SeungHak (F). Telegram wording and links for task edit, delete and start; no database needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMessage, deepLink, effectiveEvents } from '../../server/src/utils/notify.js'
import { EVENTS } from '../../server/src/constants.js'

const task = {
  _id: '000000000000000000000301',
  title: 'Eye check',
  startAt: '2030-03-05T02:00:00.000Z', // Tue 5 Mar, 10am in Singapore
  recipient: { name: 'Tan Ah Kow', nickname: 'Grandpa' },
  createdBy: { name: 'Alex Tan' },
  claimedBy: { name: 'Wei Ling Tan' },
}

test('task edit, delete and start say who did it and to which task', () => {
  assert.equal(buildMessage(EVENTS.TASK_UPDATED, task).text, 'Alex updated: Eye check for Grandpa, Tue, 5 Mar 10:00am.')
  assert.equal(buildMessage(EVENTS.TASK_DELETED, task).text, 'Alex removed: Eye check for Grandpa.')
  assert.equal(buildMessage(EVENTS.TASK_STARTED, task).text, 'Wei started: Eye check for Grandpa.')
})

test('a deleted task has no link, since its page is gone', (t) => {
  process.env.APP_URL = 'https://app.example.test'
  t.after(() => delete process.env.APP_URL)
  const link = (eventType) => deepLink({ eventType, refType: 'task', refId: task._id, familyId: 'f1' })
  assert.equal(link(EVENTS.TASK_UPDATED), `https://app.example.test/families/f1/tasks/${task._id}`)
  assert.equal(link(EVENTS.TASK_DELETED), '')
})

test('the new task events are on by default', () => {
  for (const eventType of [EVENTS.TASK_UPDATED, EVENTS.TASK_DELETED, EVENTS.TASK_STARTED])
    assert.ok(effectiveEvents([]).includes(eventType))
})
