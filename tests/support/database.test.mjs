import test from 'node:test'
import assert from 'node:assert/strict'
import { validateTestDatabaseUri, assertTestDatabase } from '../../server/test/support/database.js'
import { recurringTaskPayload } from './recurring-fixtures.mjs'

test('test database guard accepts only named, isolated loopback databases', () => {
  assert.doesNotThrow(() => validateTestDatabaseUri('mongodb://127.0.0.1:27017/carecircle_test_api_123?replicaSet=testset'))
  for (const uri of ['mongodb+srv://cluster.example/carecircle_test_api', 'mongodb://127.0.0.1/carecircle', 'mongodb://remote.example/carecircle_test_api', 'mongodb://127.0.0.1/', 'not-a-uri']) assert.throws(() => validateTestDatabaseUri(uri))
  assert.throws(() => assertTestDatabase(), /Refusing to reset/)
})
test('recurring fixtures remain in the future at Singapore day/year boundaries', () => {
  for (const instant of ['2026-12-31T15:59:59Z', '2026-12-31T16:00:00Z']) {
    const now = new Date(instant), payload = recurringTaskPayload({ now })
    assert.ok(new Date(payload.startAt) > now)
    assert.equal(new Date(payload.endAt) - new Date(payload.startAt), 3600000)
    assert.equal(payload.recurrence.end.count, 8)
  }
  assert.equal(recurringTaskPayload({ never: true }).recurrence.end.mode, 'never')
})
