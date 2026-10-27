// Owner: SeungHak (F). Telegram wording and links for care log events; no database needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMessage, deepLink, effectiveEvents, parseNotifyOn } from '../../server/src/utils/notify.js'
import { EVENTS } from '../../server/src/constants.js'

const grandpa = { _id: '000000000000000000000201', name: 'Tan Ah Kow', nickname: 'Grandpa' }
const note = {
  type: 'consultation',
  content: 'Doctor raised the blood pressure dose.',
  recipient: grandpa,
  author: { name: 'Alex Tan' },
}

test('care log messages say who and which kind of note, never the note itself', () => {
  assert.equal(buildMessage(EVENTS.LOG_CREATED, note).text, 'New consultation note for Grandpa.')
  assert.equal(buildMessage(EVENTS.LOG_UPDATED, note).text, 'Alex edited a consultation note for Grandpa.')
  assert.equal(
    buildMessage(EVENTS.LOG_DELETED, { ...note, type: 'symptom', changedBy: { name: 'Aunt May Lim' } }).text,
    'Aunt May deleted a care note for Grandpa.',
  )
  for (const event of [EVENTS.LOG_CREATED, EVENTS.LOG_UPDATED, EVENTS.LOG_DELETED]) {
    const message = buildMessage(event, note)
    assert.ok(!message.text.includes('blood pressure'))
    assert.deepEqual([message.refType, message.refId], ['careRecipient', grandpa._id])
  }
})

test('care log events link to the recipient\'s Log page', (t) => {
  process.env.APP_URL = 'https://app.example.test/'
  t.after(() => delete process.env.APP_URL)
  for (const eventType of [EVENTS.LOG_CREATED, EVENTS.LOG_UPDATED, EVENTS.LOG_DELETED]) {
    assert.equal(
      deepLink({ eventType, refType: 'careRecipient', refId: grandpa._id, familyId: 'f1' }),
      `https://app.example.test/recipients/${grandpa._id}/log`,
    )
  }
})

test('the new events are on by default and can be switched off', () => {
  assert.ok(effectiveEvents([]).includes(EVENTS.LOG_UPDATED))
  assert.ok(effectiveEvents([]).includes(EVENTS.LOG_DELETED))
  assert.deepEqual(parseNotifyOn(['log.updated']).value, ['log.updated'])
})
