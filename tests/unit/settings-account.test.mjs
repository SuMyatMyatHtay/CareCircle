// Exercise the actual frontend adapters/composable without a browser or MongoDB.
// Vite handles import.meta.env; Axios, storage and navigation are isolated doubles.
import test, { before, beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../client/node_modules/vite/dist/node/index.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}
const storage = memoryStorage(),
  local = memoryStorage()
const savedUser = {
  id: 'alex',
  name: 'Cached Alex',
  phone: '',
  preferredLang: 'en',
}
const currentUser = {
  id: 'alex',
  name: 'Alex Tan',
  email: 'alex@carecircle.test',
  phone: '80000000',
  preferredLang: 'zh',
  telegramUsername: 'alex_sample',
  isCaretaker: true,
}
const descriptors = Object.fromEntries(
  ['window', 'sessionStorage', 'localStorage'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
)
let vite,
  cacheDir,
  api,
  http,
  axios,
  family,
  mountActions,
  mounted,
  events,
  navigations

before(async () => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: storage,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: local,
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { dispatchEvent: (event) => events.push(event.type) },
  })
  cacheDir = await mkdtemp(join(tmpdir(), 'carecircle-settings-tests-'))
  vite = await createServer({
    root: fileURLToPath(new URL('../../client/', import.meta.url)),
    configFile: false,
    cacheDir,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      {
        name: 'settings-account-unit-harness',
        resolveId(id) {
          if (id === 'virtual:settings-account-test')
            return '\0settings-account-test'
        },
        load(id) {
          if (id !== '\0settings-account-test') return
          return `
          import { createRenderer } from 'vue'
          import { routerKey } from 'vue-router'
          export { default as axios } from 'axios'
          import { useSettingsAccountActions } from '/src/features/settings/composables/useSettingsAccountActions.js'
          const renderer = createRenderer({
            createComment: () => ({ children: [] }), createText: text => ({ text }),
            createElement: () => ({ children: [] }),
            insert: (child, parent) => { child.parent = parent; parent.children.push(child) },
            remove: child => { if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child) },
            parentNode: node => node.parent, nextSibling: () => null,
            patchProp: () => {}, setText: () => {}, setElementText: () => {}
          })
          export function mountActions(isPreview, router) {
            let actions
            const app = renderer.createApp({ setup() { actions = useSettingsAccountActions(); return () => null } })
            app.provide(Symbol.for('carecircle:family-workspace'), { isPreview })
            app.provide(routerKey, router)
            app.mount({ children: [] })
            return { actions, unmount: () => app.unmount() }
          }
        `
        },
      },
    ],
  })
  api = await vite.ssrLoadModule(
    '/src/features/settings/services/settingsApi.js',
  )
  ;({ http } = await vite.ssrLoadModule('/src/services/http.js'))
  family = (
    await vite.ssrLoadModule('/src/composables/useActiveFamily.js')
  ).useActiveFamily()
  ;({ mountActions, axios } = await vite.ssrLoadModule(
    'virtual:settings-account-test',
  ))
})
beforeEach(() => {
  events = []
  navigations = []
  mounted = null
  storage.clear()
  local.clear()
  storage.setItem('token', 'test-only-token')
  storage.setItem('user', JSON.stringify(savedUser))
  storage.setItem('activeFamilyId', 'old-family')
  family.clearFamilies()
  family.families.value = [
    { id: 'old-family', name: 'Sample family', members: [] },
  ]
  family.selectFamily('old-family')
})
afterEach(() => mounted?.unmount())
after(async () => {
  await vite?.close()
  if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
function account(isPreview = false) {
  mounted = mountActions(isPreview, {
    replace: async (path) => {
      navigations.push(path)
    },
  })
  return mounted.actions
}
function assertSignedOut() {
  for (const key of ['token', 'user', 'activeFamilyId'])
    assert.equal(storage.getItem(key), null)
  assert.equal(family.selectedFamilyId.value, '')
  assert.equal(family.families.value.length, 0)
  assert.deepEqual(navigations, ['/login'])
}

test('profile edits preserve fresh language, Telegram and caretaker values', async (t) => {
  const updated = { ...currentUser, name: 'Alex Edited', phone: '81111111' }
  t.mock.method(http, 'get', async (path, config) => {
    assert.equal(path, '/auth/me')
    assert.equal(config.headers.Authorization, 'Bearer test-only-token')
    return { data: { user: currentUser } }
  })
  t.mock.method(http, 'patch', async (path, body) => {
    assert.equal(path, '/auth/me')
    assert.deepEqual(body, {
      name: 'Alex Edited',
      phone: '81111111',
      preferredLang: 'zh',
      telegramUsername: 'alex_sample',
      isCaretaker: true,
    })
    return { data: { user: updated } }
  })
  assert.deepEqual(
    await api.saveProfile({ name: 'Alex Edited', phone: '81111111' }),
    updated,
  )
  assert.deepEqual(JSON.parse(storage.getItem('user')), updated)
  assert.deepEqual(events, ['carecircle:profile-updated'])
})
test('language saves use the current server profile instead of stale cached fields', async (t) => {
  t.mock.method(http, 'get', async () => ({ data: { user: currentUser } }))
  t.mock.method(http, 'patch', async (_path, body) => {
    assert.equal(body.name, currentUser.name)
    assert.equal(body.phone, currentUser.phone)
    assert.equal(body.telegramUsername, currentUser.telegramUsername)
    assert.equal(body.preferredLang, 'ta')
    return { data: { user: { ...currentUser, preferredLang: 'ta' } } }
  })
  await api.saveLanguage('ta')
  assert.equal(JSON.parse(storage.getItem('user')).preferredLang, 'ta')
})
test('a failed profile save leaves cached user details untouched', async (t) => {
  t.mock.method(http, 'get', async () => ({ data: { user: currentUser } }))
  t.mock.method(http, 'patch', async () => {
    throw new Error('Service unavailable')
  })
  await assert.rejects(
    api.saveProfile({ name: 'Alex Edited', phone: '' }),
    /Service unavailable/,
  )
  assert.deepEqual(JSON.parse(storage.getItem('user')), savedUser)
  assert.deepEqual(events, [])
})
test('a malformed success response cannot replace the cached user', async (t) => {
  t.mock.method(http, 'get', async () => ({ data: { user: currentUser } }))
  t.mock.method(http, 'patch', async () => ({ data: { success: false } }))
  await assert.rejects(
    api.saveProfile({ name: 'Alex Edited', phone: '' }),
    /profile/i,
  )
  assert.deepEqual(JSON.parse(storage.getItem('user')), savedUser)
  assert.deepEqual(events, [])
})
test('successful logout clears session details and cached families', async (t) => {
  t.mock.method(http, 'post', async (path, body, config) => {
    assert.equal(path, '/auth/logout')
    assert.deepEqual(body, {})
    assert.equal(config.headers.Authorization, 'Bearer test-only-token')
    return { data: { success: true } }
  })
  const actions = account()
  await actions.logOut()
  assertSignedOut()
  assert.equal(actions.loggingOut.value, false)
})
test('expired-session logout still clears local account and family state', async (t) => {
  t.mock.method(http, 'post', async () => {
    throw Object.assign(new Error('Expired'), { response: { status: 401 } })
  })
  await account().logOut()
  assertSignedOut()
})
test('a server failure during logout preserves the session for a retry', async (t) => {
  t.mock.method(http, 'post', async () => {
    throw Object.assign(new Error('Offline'), {
      response: { status: 503, data: { error: 'Service unavailable' } },
    })
  })
  const actions = account()
  await actions.logOut()
  assert.equal(storage.getItem('token'), 'test-only-token')
  assert.deepEqual(JSON.parse(storage.getItem('user')), savedUser)
  assert.equal(family.selectedFamilyId.value, 'old-family')
  assert.equal(family.families.value.length, 1)
  assert.equal(actions.logoutError.value, 'Service unavailable')
  assert.deepEqual(navigations, [])
})
test('preview logout never revokes or clears a real session', async (t) => {
  const post = t.mock.method(http, 'post', async () => {
    throw new Error('Should not be called')
  })
  await account(true).logOut()
  assert.equal(post.mock.callCount(), 0)
  assert.equal(storage.getItem('token'), 'test-only-token')
  assert.equal(family.selectedFamilyId.value, 'old-family')
  assert.equal(family.families.value.length, 1)
  assert.deepEqual(navigations, ['/login'])
})
test('repeated logout clicks send only one request while it is pending', async (t) => {
  let finish
  const pending = new Promise((resolve) => {
    finish = resolve
  })
  const post = t.mock.method(http, 'post', () => pending)
  const actions = account()
  const first = actions.logOut()
  await actions.logOut()
  assert.equal(post.mock.callCount(), 1)
  assert.equal(storage.getItem('token'), 'test-only-token')
  finish({ data: { success: true } })
  await first
  assertSignedOut()
})

test('a profile reply for a different user is rejected', async (t) => {
  t.mock.method(http, 'get', async () => ({ data: { user: currentUser } }))
  t.mock.method(http, 'patch', async () => ({
    data: { user: { ...currentUser, id: 'jasmine' } },
  }))
  await assert.rejects(
    api.saveProfile({ name: 'Alex Edited', phone: '' }),
    /profile/i,
  )
  assert.deepEqual(JSON.parse(storage.getItem('user')), savedUser)
  assert.deepEqual(events, [])
})
test('switching accounts during the profile read prevents a write to the new account', async (t) => {
  const newUser = { ...currentUser, id: 'jasmine', name: 'Jasmine Tan' }
  t.mock.method(http, 'get', async () => {
    storage.setItem('token', 'new-user-token')
    storage.setItem('user', JSON.stringify(newUser))
    return { data: { user: currentUser } }
  })
  const patch = t.mock.method(http, 'patch', async () => {
    throw new Error('Should not be called')
  })
  await assert.rejects(
    api.saveProfile({ name: 'Alex Edited', phone: '' }),
    /account changed/i,
  )
  assert.equal(patch.mock.callCount(), 0)
  assert.deepEqual(JSON.parse(storage.getItem('user')), newUser)
  assert.deepEqual(events, [])
})
test('a late profile save cannot overwrite a newly logged-in user', async (t) => {
  const newUser = { ...currentUser, id: 'jasmine', name: 'Jasmine Tan' }
  t.mock.method(http, 'get', async () => ({ data: { user: currentUser } }))
  t.mock.method(http, 'patch', async (_path, _body, config) => {
    assert.equal(config.headers.Authorization, 'Bearer test-only-token')
    storage.setItem('token', 'new-user-token')
    storage.setItem('user', JSON.stringify(newUser))
    return { data: { user: { ...currentUser, name: 'Alex Edited' } } }
  })
  await assert.rejects(
    api.saveProfile({ name: 'Alex Edited', phone: '' }),
    /account changed/i,
  )
  assert.deepEqual(JSON.parse(storage.getItem('user')), newUser)
  assert.deepEqual(events, [])
})
test('a late logout reply cannot clear a new account or its family cache', async (t) => {
  const newUser = { ...currentUser, id: 'jasmine', name: 'Jasmine Tan' }
  t.mock.method(http, 'post', async () => {
    storage.setItem('token', 'new-user-token')
    storage.setItem('user', JSON.stringify(newUser))
    family.families.value = [
      { id: 'new-family', name: 'New sample family', members: [] },
    ]
    family.selectFamily('new-family')
    return { data: { success: true } }
  })
  await account().logOut()
  assert.equal(storage.getItem('token'), 'new-user-token')
  assert.deepEqual(JSON.parse(storage.getItem('user')), newUser)
  assert.equal(family.selectedFamilyId.value, 'new-family')
  assert.equal(family.families.value.length, 1)
  assert.deepEqual(navigations, [])
})
test('logout without a token still clears stale account and family details', async (t) => {
  storage.removeItem('token')
  const post = t.mock.method(http, 'post', async () => {
    throw new Error('Should not be called')
  })
  await account().logOut()
  assert.equal(post.mock.callCount(), 0)
  assertSignedOut()
})

test('a family reply started before logout cannot repopulate cleared state', async (t) => {
  let finish
  t.mock.method(
    axios,
    'get',
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const pending = family.loadFamilies()
  family.clearFamilies()
  finish({
    data: {
      families: [
        {
          id: 'previous-account-family',
          name: 'Previous sample family',
          inviteCode: 'SAMPLE',
        },
      ],
    },
  })
  await pending
  assert.equal(family.families.value.length, 0)
  assert.equal(family.selectedFamilyId.value, '')
  assert.equal(storage.getItem('activeFamilyId'), null)
  assert.equal(family.isLoading.value, false)
})
test('a newer family refresh wins over an older response arriving later', async (t) => {
  let finishOlder,
    finishNewer,
    requests = 0
  t.mock.method(
    axios,
    'get',
    () =>
      new Promise((resolve) => {
        if (++requests === 1) finishOlder = resolve
        else finishNewer = resolve
      }),
  )
  const older = family.loadFamilies()
  const newer = family.loadFamilies()
  finishNewer({
    data: { families: [{ id: 'latest-family', name: 'Latest family' }] },
  })
  await newer
  finishOlder({
    data: { families: [{ id: 'outdated-family', name: 'Outdated family' }] },
  })
  await older
  assert.equal(family.families.value[0].id, 'latest-family')
  assert.equal(family.selectedFamilyId.value, 'latest-family')
})
test('an older failed family request does not erase a newer successful result', async (t) => {
  let failOlder,
    requests = 0
  t.mock.method(axios, 'get', () => {
    if (++requests === 1)
      return new Promise((_resolve, reject) => {
        failOlder = reject
      })
    return Promise.resolve({
      data: { families: [{ id: 'latest-family', name: 'Latest family' }] },
    })
  })
  const older = family.loadFamilies()
  await family.loadFamilies()
  failOlder(new Error('Old request failed'))
  await older
  assert.equal(family.families.value[0].id, 'latest-family')
  assert.equal(family.errorMessage.value, '')
})
test('a new sign-in clears the previous account family cache before loading', async (t) => {
  let finish
  t.mock.method(
    axios,
    'get',
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  storage.setItem('token', 'new-account-token')
  storage.setItem(
    'user',
    JSON.stringify({ id: 'jasmine', name: 'Jasmine Tan' }),
  )
  const pending = family.loadFamilies()
  assert.equal(family.families.value.length, 0)
  finish({
    data: { families: [{ id: 'new-account-family', name: 'New family' }] },
  })
  await pending
  assert.equal(family.families.value[0].id, 'new-account-family')
})
