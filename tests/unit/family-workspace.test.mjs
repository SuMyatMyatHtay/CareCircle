// Merge regression checks: B's dashboard and C/D's pages share real query hooks.
// HTTP/storage are isolated; these tests never use MongoDB or a real account.
import test, { before, beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../client/node_modules/vite/dist/node/index.js'

const storage = new Map()
const storageApi = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
}
const descriptors = Object.fromEntries(
  ['window', 'document', 'sessionStorage', 'localStorage'].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
)
let vite, cacheDir, harness, http, family, mounted
const tick = () => new Promise(resolve => setTimeout(resolve, 2))
async function settled() {
  await harness.nextTick()
  await tick()
  await harness.nextTick()
}
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date())
const startAt = new Date(`${day}T12:00:00+08:00`).toISOString()
const task = (id, extra = {}) => ({ _id: id, title: id, startAt, status: 'open', ...extra })
const recipient = id => ({ _id: id, name: id, careType: 'elderly' })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

before(async () => {
  for (const [key, value] of Object.entries({
    window: { location: { href: 'http://127.0.0.1:5174/' }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
    document: { visibilityState: 'visible', createElement: () => ({}), addEventListener() {}, removeEventListener() {} },
    sessionStorage: storageApi,
    localStorage: storageApi,
  })) Object.defineProperty(globalThis, key, { configurable: true, value })
  cacheDir = await mkdtemp(join(tmpdir(), 'carecircle-workspace-tests-'))
  vite = await createServer({
    root: fileURLToPath(new URL('../../client/', import.meta.url)),
    configFile: false, cacheDir, logLevel: 'silent', appType: 'custom',
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{
      name: 'workspace-query-harness',
      resolveId: id => id === 'virtual:workspace-test' ? '\0workspace-test' : undefined,
      load(id) {
        if (id !== '\0workspace-test') return
        return `
          import { createRenderer, h } from 'vue'
          export { nextTick } from 'vue'
          import { VueQueryPlugin } from '@tanstack/vue-query'
          import { provideFamilyWorkspace } from '/src/features/family/composables/useFamilyWorkspace.js'
          import { useFamilyDashboard } from '/src/features/family/composables/useFamilyDashboard.js'
          import { useFamilyTasks } from '/src/composables/useFamilyTasks.js'
          import { useTaskForm } from '/src/features/tasks/composables/useTaskForm.js'
          import { useActiveFamily } from '/src/composables/useActiveFamily.js'
          import { queryClient, queryKeys } from '/src/services/queryClient.js'
          export { queryClient, queryKeys, useActiveFamily }
          const renderer = createRenderer({
            createComment: () => ({}), createText: () => ({}), createElement: () => ({}),
            insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null,
            patchProp() {}, setText() {}, setElementText() {}
          })
          export function mountWorkspace(preview = false) {
            const result = {}
            const Child = { setup() {
              result.dashboard = useFamilyDashboard()
              if (!preview) {
                result.fullList = useFamilyTasks()
                result.form = useTaskForm()
              }
              return () => null
            } }
            const app = renderer.createApp({ setup() {
              result.workspace = provideFamilyWorkspace(preview)
              return () => h(Child)
            } })
            app.use(VueQueryPlugin, { queryClient })
            app.mount({})
            return { ...result, unmount: () => app.unmount() }
          }
        `
      },
    }],
  })
  harness = await vite.ssrLoadModule('virtual:workspace-test')
  ;({ http } = await vite.ssrLoadModule('/src/services/http.js'))
  family = harness.useActiveFamily()
})
beforeEach(() => {
  storage.clear()
  storage.set('token', 'test-only-token')
  storage.set('user', JSON.stringify({ id: 'alex', name: 'Alex' }))
  family.clearFamilies()
  family.families.value = ['one', 'two'].map(id => ({ id, name: id, members: [] }))
  family.selectFamily('one')
  harness.queryClient.clear()
  mounted = null
})
afterEach(() => {
  mounted?.unmount()
  harness.queryClient.clear()
})
after(async () => {
  await vite?.close()
  if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
function seed(tasks = [task('today')], recipients = [recipient('Grandpa')]) {
  harness.queryClient.setQueryData(harness.queryKeys.tasks('one'), tasks)
  harness.queryClient.setQueryData(harness.queryKeys.recipientList('one'), recipients)
}

test('D task creation appears on Home without losing completed or distant tasks', async t => {
  const completed = task('completed', { status: 'completed' })
  const distant = task('future', { startAt: new Date(Date.now() + 30 * 86400000).toISOString() })
  seed([task('today'), completed, distant])
  mounted = harness.mountWorkspace()
  assert.deepEqual(mounted.dashboard.tasks.value.map(t => t._id), ['today'])
  const created = task('new task')
  t.mock.method(http, 'post', async (path, body) => {
    assert.equal(path, '/families/one/tasks')
    assert.equal(body.title, 'new task')
    return { data: { task: created } }
  })
  mounted.form.title.value = 'new task'
  mounted.form.startTime.value = '12:00'
  assert.ok(await mounted.form.submit('one'))
  await settled()
  assert.deepEqual(mounted.dashboard.tasks.value.map(t => t._id), ['today', 'new task'])
  assert.equal(mounted.fullList.tasks.value.length, 4)
  assert.ok(mounted.fullList.tasks.value.some(t => t._id === 'completed'))
  assert.ok(mounted.fullList.tasks.value.some(t => t._id === 'future'))
})

test('C recipient invalidation refreshes the Home/sidebar workspace', async t => {
  seed()
  mounted = harness.mountWorkspace()
  const next = [recipient('Grandpa'), recipient('Grandma')]
  t.mock.method(http, 'get', async path => {
    assert.equal(path, '/families/one/recipients')
    return { data: { recipients: next } }
  })
  await mounted.workspace.loadRecipients()
  await settled()
  assert.deepEqual(mounted.workspace.recipients.value.map(r => r._id), ['Grandpa', 'Grandma'])
})

test('switching families isolates cached data and late replies', async t => {
  seed()
  mounted = harness.mountWorkspace()
  const waiting = { tasks: deferred(), recipients: deferred() }
  t.mock.method(http, 'get', path => {
    assert.ok(path.startsWith('/families/two/'))
    return waiting[path.split('/').at(-1)].promise
  })
  family.selectFamily('two')
  await settled()
  assert.equal(mounted.dashboard.tasks.value.length, 0)
  assert.equal(mounted.workspace.recipients.value.length, 0)
  family.selectFamily('one')
  await settled()
  waiting.tasks.resolve({ data: { tasks: [task('two-task')] } })
  waiting.recipients.resolve({ data: { recipients: [recipient('two-recipient')] } })
  await settled()
  assert.deepEqual(mounted.dashboard.tasks.value.map(t => t._id), ['today'])
  assert.deepEqual(mounted.workspace.recipients.value.map(r => r._id), ['Grandpa'])
})

test('preview never fetches the signed-in family even with an active real session', async t => {
  const get = t.mock.method(http, 'get', async () => { throw new Error('Preview must stay local') })
  mounted = harness.mountWorkspace(true)
  await mounted.dashboard.loadTasks()
  await mounted.workspace.loadRecipients()
  await settled()
  assert.equal(get.mock.callCount(), 0)
  assert.ok(mounted.dashboard.tasks.value.length)
  assert.ok(mounted.workspace.recipients.value.length)
  assert.equal(family.selectedFamilyId.value, 'one')
})

test('a pre-claim task list reply cannot undo a successful claim', async t => {
  seed()
  mounted = harness.mountWorkspace()
  const waiting = deferred()
  t.mock.method(http, 'get', () => waiting.promise)
  const refresh = mounted.dashboard.loadTasks(true)
  await settled()
  t.mock.method(http, 'post', async path => {
    assert.equal(path, '/families/one/tasks/today/claim')
    return { data: { task: task('today', { status: 'claimed' }) } }
  })
  await mounted.dashboard.claimTask(mounted.dashboard.tasks.value[0])
  waiting.resolve({ data: { tasks: [task('today')] } })
  await refresh
  await settled()
  assert.equal(mounted.dashboard.tasks.value[0].status, 'claimed')
  assert.equal(mounted.fullList.tasks.value[0].status, 'claimed')
})
