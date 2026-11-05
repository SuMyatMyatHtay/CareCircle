import test from 'node:test'
import assert from 'node:assert/strict'
import { generateReply } from '../../server/src/features/assistant/gemini.js'

const success = () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP',
  content: { parts: [{ text: JSON.stringify({ intent: 'reply', message: 'Hello', suggestions: [] }) }] }
}] }))

test('Gemini retry policy', async t => {
  const oldKey = process.env.GEMINI_API_KEY
  const oldModel = process.env.GEMINI_MODEL
  const oldFallback = process.env.GEMINI_FALLBACK_MODEL
  process.env.GEMINI_API_KEY = 'test-key'
  process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite'
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash'
  t.after(() => {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = oldKey
    if (oldModel === undefined) delete process.env.GEMINI_MODEL
    else process.env.GEMINI_MODEL = oldModel
    if (oldFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL
    else process.env.GEMINI_FALLBACK_MODEL = oldFallback
  })
  t.mock.method(console, 'warn', () => {})
  t.mock.method(console, 'error', () => {})
  const input = { messages: [{ role: 'user', content: 'Hi' }], context: {}, random: () => 0 }

  await t.test('switches after two server errors and preserves credentials, prompt, schema and deadline', async () => {
    const requests = []
    const result = await generateReply({ ...input, sleepImpl: async () => {},
      fetchImpl: async (url, options) => {
        requests.push({ url, options })
        return requests.length < 3 ? new Response('', { status: 503 }) : success()
      }
    })
    assert.equal(result.message, 'Hello')
    assert.ok(requests.slice(0, 2).every(r => r.url.includes('/gemini-3.5-flash-lite:')))
    assert.ok(requests[2].url.includes('/gemini-3.8-flash:'))
    assert.equal(requests[2].options.body, requests[0].options.body)
    assert.equal(requests[2].options.signal, requests[0].options.signal)
    assert.equal(requests[2].options.headers['x-goog-api-key'], 'test-key')
  })

  await t.test('quota and network errors do not switch models', async () => {
    for (const status of [429, 'network']) {
      const urls = []
      await assert.rejects(generateReply({ ...input, sleepImpl: async () => {},
        fetchImpl: async url => {
          urls.push(url)
          if (status === 'network') throw new TypeError('fetch failed')
          return new Response('', { status })
        }
      }))
      assert.equal(urls.length, 6)
      assert.ok(urls.every(url => url.includes('/gemini-3.5-flash-lite:')))
    }
  })

  await t.test('fallback can be disabled or set equal to the primary', async () => {
    for (const fallback of ['off', 'gemini-3.5-flash-lite']) {
      process.env.GEMINI_FALLBACK_MODEL = fallback
      const urls = []
      await assert.rejects(generateReply({ ...input, sleepImpl: async () => {},
        fetchImpl: async url => { urls.push(url); return new Response('', { status: 503 }) }
      }))
      assert.equal(urls.length, 6)
      assert.ok(urls.every(url => url.includes('/gemini-3.5-flash-lite:')))
    }
    process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash'
  })

  await t.test('invalid fallback configuration fails before contacting Google', async () => {
    process.env.GEMINI_FALLBACK_MODEL = 'invalid/model'
    await assert.rejects(generateReply({ ...input,
      fetchImpl: async () => assert.fail('unexpected provider request')
    }), /fallback model name is invalid/)
    process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash'
  })

  await t.test('three transient failures recover with exponential delays and one shared deadline', async () => {
    const delays = [], signals = []
    const result = await generateReply({ ...input,
      sleepImpl: async ms => { delays.push(ms) },
      fetchImpl: async (url, options) => {
        signals.push(options.signal)
        return signals.length < 4 ? new Response('', { status: 503 }) : success()
      }
    })
    assert.equal(result.message, 'Hello')
    assert.deepEqual(delays, [1000, 2000, 4000])
    assert.ok(signals.every(signal => signal === signals[0]))
  })

  await t.test('permanent provider errors are never retried', async () => {
    for (const status of [400, 401, 403, 404]) {
      let calls = 0
      await assert.rejects(generateReply({ ...input,
        fetchImpl: async () => { calls++; return new Response('', { status }) },
        sleepImpl: async () => assert.fail('unexpected retry')
      }), /Check the Gemini API key/)
      assert.equal(calls, 1)
    }
  })

  await t.test('retries stop after the initial attempt plus five retries and emit accurate progress', async () => {
    let calls = 0
    const progress = [], delays = []
    await assert.rejects(generateReply({ ...input, sleepImpl: async ms => { delays.push(ms) },
      onRetry: event => progress.push(event),
      fetchImpl: async () => { calls++; return new Response('', { status: 503 }) }
    }), /temporarily unavailable/)
    assert.equal(calls, 6)
    assert.deepEqual(progress, [1, 2, 3, 4, 5].map(retry => ({ retry, maxRetries: 5 })))
    assert.deepEqual(delays, [1000, 2000, 4000, 8000, 8000])
  })

  await t.test('cancellation stops backoff without making another provider request', async () => {
    const controller = new AbortController()
    let calls = 0
    await assert.rejects(generateReply({ ...input, signal: controller.signal,
      onRetry: () => controller.abort(),
      fetchImpl: async () => { calls++; return new Response('', { status: 503 }) }
    }), { status: 503 })
    assert.equal(calls, 1)
  })

  await t.test('Retry-After supports seconds and HTTP dates', async () => {
    for (const header of ['5', new Date(5000).toUTCString()]) {
      let calls = 0
      const delays = []
      await generateReply({ ...input, now: () => 0,
        sleepImpl: async ms => { delays.push(ms) },
        fetchImpl: async () => ++calls === 1
          ? new Response('', { status: 429, headers: { 'Retry-After': header } }) : success()
      })
      assert.deepEqual(delays, [5000])
    }
  })

  await t.test('long quota cooldowns return immediately instead of exceeding the deadline', async () => {
    let calls = 0
    await assert.rejects(generateReply({ ...input,
      sleepImpl: async () => assert.fail('unexpected retry'),
      fetchImpl: async () => {
        calls++
        return new Response('', { status: 429, headers: { 'Retry-After': '60' } })
      }
    }), { status: 429 })
    assert.equal(calls, 1)
  })

  await t.test('network failure recovers and jitter spreads retry times', async () => {
    let calls = 0
    const delays = []
    await generateReply({ ...input, random: () => 0.5,
      sleepImpl: async ms => { delays.push(ms) },
      fetchImpl: async () => { if (++calls === 1) throw new TypeError('fetch failed'); return success() }
    })
    assert.deepEqual(delays, [1125])
  })

  await t.test('elapsed request time counts against the retry budget', async () => {
    let time = 0, calls = 0
    await assert.rejects(generateReply({ ...input, now: () => time,
      sleepImpl: async () => assert.fail('unexpected retry'),
      fetchImpl: async () => { calls++; time = 44000; return new Response('', { status: 503 }) }
    }), /temporarily unavailable/)
    assert.equal(calls, 1)
  })
})
