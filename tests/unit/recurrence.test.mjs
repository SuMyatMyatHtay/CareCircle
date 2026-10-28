import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRecurrence, recurrenceDates, generationHorizon, sgDay } from '../../shared/recurrence.js'

function dates(start, input, end = null, horizon = generationHorizon(start)) {
  return recurrenceDates(parseRecurrence(input, start), start, end, horizon)
}
test('Tuesday/Friday recurrence includes the last date and preserves Singapore time/duration', () => {
  const result = dates('2026-11-03T06:30:00Z', { frequency: 'weekly', weekdays: [1, 4], end: { mode: 'on', until: '2026-12-18' } }, '2026-11-03T07:30:00Z')
  assert.equal(result.length, 14)
  assert.equal(sgDay(result.at(-1).startAt), '2026-12-18')
  assert.ok(result.every((d, i) => d.index === i && d.startAt.getUTCHours() === 6 && d.endAt - d.startAt === 3600000))
})
test('biweekly schedules use Monday-based weeks across year boundaries', () => {
  const result = dates('2026-12-29T06:00:00Z', { frequency: 'weekly', interval: 2, weekdays: [1, 4], end: { mode: 'after', count: 4 } })
  assert.deepEqual(result.map(d => sgDay(d.startAt)), ['2026-12-29', '2027-01-01', '2027-01-12', '2027-01-15'])
})
test('monthly schedules skip nonexistent dates and handle leap years', () => {
  assert.deepEqual(dates('2027-01-31T06:00:00Z', { frequency: 'monthly', end: { mode: 'after', count: 3 } }).map(d => sgDay(d.startAt)), ['2027-01-31', '2027-03-31', '2027-05-31'])
  assert.equal(sgDay(dates('2028-01-29T06:00:00Z', { frequency: 'monthly', end: { mode: 'after', count: 2 } })[1].startAt), '2028-02-29')
})
test('rolling windows extend with stable occurrence indexes at Singapore midnight', () => {
  const start = '2026-11-01T16:15:00Z', rule = { frequency: 'daily' }
  const first = dates(start, rule, null, generationHorizon(start, new Date(start)))
  const next = dates(start, rule, null, generationHorizon(start, new Date('2026-11-08T16:15:00Z')))
  assert.equal(first.length, 29)
  assert.equal(next.length, 36)
  assert.deepEqual(next.slice(0, first.length), first)
  assert.equal(sgDay(first[0].startAt), '2026-11-02')
})
test('invalid input and oversized finite series are rejected', () => {
  const start = '2026-11-03T06:00:00Z'
  for (const input of [{ frequency: 'weekly', weekdays: [] }, { frequency: 'daily', interval: 0 }, { frequency: 'daily', end: { mode: 'after', count: 501 } }, { frequency: 'daily', end: { mode: 'on', until: '2026-02-30' } }]) assert.throws(() => dates(start, input), { status: 400 })
  assert.throws(() => dates(start, { frequency: 'daily', end: { mode: 'on', until: '2028-11-03' } }), /at most 500/)
  assert.equal(dates(start, { frequency: 'daily', end: { mode: 'after', count: 500 } }).length, 500)
  assert.equal(parseRecurrence({ frequency: 'none' }, start), null)
})
