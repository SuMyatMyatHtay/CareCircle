// Mount the real composable with Vue's renderer and a query cache, no browser or API calls.
import test, { before, beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../client/node_modules/vite/dist/node/index.js'

const values = new Map()
const descriptors = Object.fromEntries(['window', 'sessionStorage', 'CustomEvent'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
let vite, cacheDir, mountChat, payload, http, mounted, events
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const proposal = { id: 'proposal-1', action: 'create', task: { title: 'Eye check', startAt: '2026-10-23T02:30:00Z', recipientName: 'Grandpa' }, changes: { title: 'Eye check' } }
before(async () => {
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)
  } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: event => events.push(event) } })
  Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class { constructor(type, options) { this.type = type; this.detail = options.detail } } })
  cacheDir = await mkdtemp(join(tmpdir(), 'carecircle-assistant-tests-'))
  vite = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)), configFile: false, cacheDir,
    logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: 'assistant-unit-harness', resolveId(id) { if (id === 'virtual:assistant-test') return '\0assistant-test' },
      load(id) { if (id !== '\0assistant-test') return
        return `
          import { createRenderer, ref, nextTick } from 'vue'
          import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
          import { useAssistantChat, conversationPayload } from '/src/features/assistant/composables/useAssistantChat.js'
          export { conversationPayload }
          const renderer = createRenderer({ createComment: () => ({ children: [] }), createText: text => ({ text }), createElement: () => ({ children: [] }),
            insert(child, parent) { child.parent = parent; parent.children.push(child) }, remove() {}, parentNode: node => node.parent,
            nextSibling: () => null, patchProp() {}, setText() {}, setElementText() {} })
          export function mountChat() {
            const user = ref({ id: 'alex' }), familyId = ref('family-a'), family = ref({ id: 'family-a', name: 'Tan family' })
            const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
            let chat
            const app = renderer.createApp({ setup() { chat = useAssistantChat(user); return () => null } })
            app.provide(Symbol.for('carecircle:family-workspace'), { selectedFamilyId: familyId, selectedFamily: family })
            app.use(VueQueryPlugin, { queryClient }); app.mount({ children: [] })
            return { chat, user, familyId, queryClient, tick: nextTick, unmount() { app.unmount(); queryClient.clear() } }
          }
        `
      } }] })
  ;({ http } = await vite.ssrLoadModule('/src/services/http.js'))
  ;({ mountChat, conversationPayload: payload } = await vite.ssrLoadModule('virtual:assistant-test'))
})
beforeEach(() => { values.clear(); values.set('token', 'assistant-test-token'); events = []; mounted = mountChat() })
afterEach(() => mounted?.unmount())
after(async () => {
  await vite?.close()
  if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
  for (const [key, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
})

test('sending a message only prepares a proposal, and confirmation updates the cache', async t => {
  const requests = []
  mounted.queryClient.setQueryData(['families', 'family-a', 'tasks'], [])
  t.mock.method(http, 'post', async (path, body, config) => {
    requests.push({ path, body }); assert.equal(config.headers.Authorization, 'Bearer assistant-test-token')
    return path.endsWith('/chat') ? { data: { message: 'Review these details', proposal } }
      : { data: { task: { _id: 'task-1', title: 'Eye check', startAt: '2026-10-23T02:30:00Z' } } }
  })
  await mounted.chat.send('Add an eye check')
  assert.equal(requests.length, 1); assert.ok(requests[0].path.endsWith('/chat'))
  const card = mounted.chat.messages.value[1]
  assert.equal(card.proposalState, 'pending')
  await mounted.chat.confirm(card)
  assert.ok(requests[1].path.endsWith('/proposals/proposal-1/confirm'))
  assert.deepEqual(requests[1].body, {})
  assert.equal(card.proposalState, 'saved')
  assert.equal(mounted.queryClient.getQueryData(['families', 'family-a', 'tasks'])[0]._id, 'task-1')
  assert.equal(events[0].type, 'carecircle:task-updated')
  await mounted.chat.confirm(card); assert.equal(requests.length, 2)
})
test('switching families aborts the request, clears chat and discards late replies', async t => {
  const pending = deferred(); let signal
  t.mock.method(http, 'post', (_path, _body, config) => { signal = config.signal; return pending.promise })
  const sending = mounted.chat.send('Private family A task')
  mounted.familyId.value = 'family-b'; await mounted.tick()
  assert.equal(signal.aborted, true); assert.equal(mounted.chat.messages.value.length, 0)
  pending.resolve({ data: { message: 'Private family A answer' } }); await sending
  assert.equal(mounted.chat.messages.value.length, 0); assert.equal(mounted.chat.busy.value, false)
})
test('an old confirmation cannot populate the next account cache', async t => {
  const pending = deferred()
  t.mock.method(http, 'post', path => path.endsWith('/chat') ? Promise.resolve({ data: { message: 'Review', proposal } }) : pending.promise)
  await mounted.chat.send('Add task')
  const confirming = mounted.chat.confirm(mounted.chat.messages.value[1])
  values.set('token', 'different-account-token'); mounted.user.value = { id: 'jasmine' }; await mounted.tick()
  pending.resolve({ data: { task: { _id: 'old-task', title: 'Old private task' } } }); await confirming
  assert.equal(mounted.chat.messages.value.length, 0)
  assert.equal(mounted.queryClient.getQueryData(['families', 'family-a', 'tasks']), undefined)
  assert.equal(events.length, 0)
})
test('a changed token without an identity update still releases the loading state', async t => {
  const pending = deferred()
  t.mock.method(http, 'post', () => pending.promise)
  const sending = mounted.chat.send('Find tasks')
  values.set('token', 'refreshed-session-token')
  pending.resolve({ data: { message: 'Old session reply' } }); await sending
  assert.equal(mounted.chat.busy.value, false)
  assert.equal(mounted.chat.messages.value.length, 1)
  assert.match(mounted.chat.error.value, /session changed/)
})
test('follow-ups replace the previous confirmation card and preserve draft context', async t => {
  let calls = 0
  t.mock.method(http, 'post', async (_path, body) => {
    if (calls++) assert.ok(body.messages.some(message => message.content.includes('Task proposal (replaced)')))
    return { data: { message: 'Review', proposal: { ...proposal, id: `proposal-${calls}` } } }
  })
  await mounted.chat.send('Add task'); const first = mounted.chat.messages.value[1]
  await mounted.chat.send('Actually make it 11 am')
  assert.equal(first.proposalState, 'replaced')
  await mounted.chat.confirm(first); assert.equal(calls, 2)
})
test('network failures preserve messages and allow retry without a duplicate user message', async t => {
  let calls = 0
  t.mock.method(http, 'post', async () => { if (!calls++) throw new Error('Offline'); return { data: { message: 'What time?', suggestions: ['10 am'] } } })
  await mounted.chat.send('Add task')
  assert.equal(mounted.chat.retryable.value, true); assert.equal(mounted.chat.busy.value, false)
  await mounted.chat.retry()
  assert.equal(mounted.chat.error.value, ''); assert.equal(mounted.chat.messages.value.length, 2)
  assert.deepEqual(mounted.chat.messages.value[1].suggestions, ['10 am'])
})
test('conversation payload is bounded, user-first, and includes task search IDs', () => {
  const messages = Array.from({ length: 80 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: 'a'.repeat(1500) }))
  messages.push({ role: 'assistant', content: 'Matching tasks', tasks: [{ id: 'task-123', title: 'Eye check' }] }, { role: 'user', content: 'Change that task' })
  const result = payload(messages)
  assert.equal(result[0].role, 'user'); assert.equal(result.at(-1).role, 'user')
  assert.ok(result.length <= 24); assert.ok(result.reduce((sum, message) => sum + message.content.length, 0) <= 22000)
  assert.ok(result.some(message => message.content.includes('task-123')))
})
