import { test, expect, ids, login, authenticatedApi } from './fixtures.mjs'
import { recurringTaskPayload } from '../support/recurring-fixtures.mjs'

const path = `/families/${ids.family}/tasks`
async function seed(page, apiURL) {
  const api = await authenticatedApi(page, apiURL)
  const response = await api(path, { method: 'POST', data: recurringTaskPayload({ count: 6 }) })
  expect(response.status()).toBe(201)
  const { task } = await response.json()
  return { api, task }
}
async function sessions(api, seriesId) {
  const response = await api(path); expect(response.status()).toBe(200)
  return (await response.json()).tasks.filter(t => t.recurringSeries === seriesId)
}
const take = page => page.getByRole('button', { name: /I.ll take it/i }).filter({ visible: true })

test('creates a daily series from the form and persists every session', async ({ page, isolatedData }) => {
  await login(page)
  await page.goto('/tasks/new')
  await page.getByLabel('What needs doing?', { exact: true }).fill('E2E repeating therapy')
  await page.getByRole('button', { name: 'Tomorrow', exact: true }).click()
  await page.getByLabel('Starts', { exact: true }).fill('14:30')
  await page.getByRole('button', { name: 'Every day', exact: true }).click()
  await page.getByRole('button', { name: 'After a number of times', exact: true }).click()
  await page.getByLabel('Sessions', { exact: true }).fill('6')
  await page.getByRole('button', { name: 'Post 6 tasks', exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
  const api = await authenticatedApi(page, isolatedData.apiURL)
  await expect.poll(async () => {
    const response = await api(path)
    return (await response.json()).tasks.filter(t => t.title === 'E2E repeating therapy').length
  }).toBe(6)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Repeating tasks', exact: true })).toBeVisible()
})

test('default series claim and a one-day handover preserve other assignments', async ({ page, isolatedData }) => {
  const { api, task } = await seed(page, isolatedData.apiURL)
  await login(page, 'may')
  await page.goto(`${path}/${task._id}`)
  await take(page).click()
  const dialog = page.getByRole('dialog', { name: `Take ${task.title}?` })
  await expect(dialog.getByRole('radio', { name: /Every upcoming session/ })).toBeChecked()
  await dialog.getByRole('button', { name: "I'll take it", exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect.poll(async () => (await sessions(api, task.recurringSeries)).filter(t => t.claimedBy?._id === ids.may).length).toBe(6)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: /Give back/i }).filter({ visible: true }).click()
  await expect.poll(async () => (await sessions(api, task.recurringSeries)).find(t => t._id === task._id)?.recurrenceDetached).toBe(true)
  await page.evaluate(() => sessionStorage.clear())
  await login(page)
  await page.goto(`${path}/${task._id}`)
  await take(page).click()
  await expect(page.getByRole('dialog', { name: `Take ${task.title}?` })).not.toBeVisible()
  await expect.poll(async () => (await sessions(api, task.recurringSeries)).find(t => t._id === task._id)?.claimedBy?._id).toBe(ids.alex)
  const saved = await sessions(api, task.recurringSeries)
  expect(saved.filter(t => t._id !== task._id).every(t => t.claimedBy?._id === ids.may)).toBe(true)
})

test('claim cancellation writes nothing; next-four limits the assignment', async ({ page, isolatedData }) => {
  const { api, task } = await seed(page, isolatedData.apiURL)
  await login(page, 'may'); await page.goto(`${path}/${task._id}`)
  await take(page).click()
  let dialog = page.getByRole('dialog', { name: `Take ${task.title}?` })
  await dialog.getByRole('button', { name: 'Not now', exact: true }).click()
  expect((await sessions(api, task.recurringSeries)).every(t => t.status === 'open')).toBe(true)
  await take(page).click()
  dialog = page.getByRole('dialog', { name: `Take ${task.title}?` })
  await dialog.getByRole('radio', { name: /The next 4 sessions/ }).check()
  await dialog.getByRole('button', { name: "I'll take it", exact: true }).click()
  await expect.poll(async () => (await sessions(api, task.recurringSeries)).filter(t => t.claimedBy?._id === ids.may).length).toBe(4)
  expect((await sessions(api, task.recurringSeries)).filter(t => t.status === 'open')).toHaveLength(2)
})
