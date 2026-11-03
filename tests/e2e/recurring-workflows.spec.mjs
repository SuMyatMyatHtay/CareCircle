import { test, expect, ids, login, authenticatedApi } from './fixtures.mjs'
import Task from '../../server/src/features/tasks/TaskModel.js'
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

test('claim cancellation writes nothing; one-session claims leave later dates available', async ({ page, isolatedData }) => {
  const { api, task } = await seed(page, isolatedData.apiURL)
  await login(page, 'may'); await page.goto(`${path}/${task._id}`)
  await take(page).click()
  let dialog = page.getByRole('dialog', { name: `Take ${task.title}?` })
  await dialog.getByRole('button', { name: 'Not now', exact: true }).click()
  expect((await sessions(api, task.recurringSeries)).every(t => t.status === 'open')).toBe(true)
  await take(page).click()
  dialog = page.getByRole('dialog', { name: `Take ${task.title}?` })
  await dialog.getByRole('radio', { name: /Just this date/ }).check()
  await dialog.getByRole('button', { name: "I'll take it", exact: true }).click()
  await expect.poll(async () => (await sessions(api, task.recurringSeries)).filter(t => t.claimedBy?._id === ids.may).length).toBe(1)
  expect((await sessions(api, task.recurringSeries)).filter(t => t.status === 'open')).toHaveLength(5)
})

async function overdueWeeklySeries(page, apiURL) {
  const api = await authenticatedApi(page, apiURL)
  const payload = recurringTaskPayload({ never: true })
  payload.recurrence.frequency = 'weekly'
  payload.recurrence.weekdays = [(new Date(payload.startAt).getUTCDay() + 6) % 7]
  const created = await api(path, { method: 'POST', data: payload })
  expect(created.status()).toBe(201)
  const task = (await created.json()).task
  await Task.updateOne({ _id: task._id }, { $set: { startAt: new Date(Date.now() - 86400000) } })
  return { api, task }
}
async function overdueBoard(page, isMobile) {
  if (isMobile) await page.getByRole('navigation', { name: 'Mobile home navigation' }).getByRole('button', { name: 'Tasks', exact: true }).click()
  await page.getByRole('button', { name: 'Overdue', exact: true }).click()
}
test('stops an overdue weekly series from the repeating-task panel, keeps history and resumes only when requested', async ({ page, isMobile, isolatedData }) => {
  const { api, task } = await overdueWeeklySeries(page, isolatedData.apiURL)
  await login(page)
  await overdueBoard(page, isMobile)
  const options = page.getByRole('button', { name: `Options for ${task.title}`, exact: true })
  const stop = page.getByRole('button', { name: 'Stop repeating', exact: true }).filter({ visible: true })
  await expect(options).toHaveCount(0)
  page.once('dialog', dialog => dialog.dismiss())
  await stop.click()
  const seriesPath = `${path}/recurring`
  const paused = async () => (await (await api(seriesPath)).json()).series.find(series => series._id === task.recurringSeries).paused
  expect(await paused()).toBe(false)
  page.once('dialog', dialog => dialog.accept())
  await stop.click()
  await expect(options).toHaveCount(0)
  expect(await paused()).toBe(true)
  let saved = await sessions(api, task.recurringSeries)
  expect(saved.find(entry => entry._id === task._id).status).toBe('open')
  expect(saved.filter(entry => entry._id !== task._id).every(entry => entry.status === 'cancelled')).toBe(true)
  const count = saved.length
  await page.reload()
  expect(await paused()).toBe(true)
  expect((await sessions(api, task.recurringSeries)).length).toBe(count)
  await page.getByRole('button', { name: 'Resume', exact: true }).filter({ visible: true }).click()
  await expect.poll(paused).toBe(false)
  saved = await sessions(api, task.recurringSeries)
  expect(saved.filter(entry => entry._id !== task._id).some(entry => entry.status === 'open')).toBe(true)
})
test('recipient permissions do not allow a member to stop someone elses schedule', async ({ page, isMobile, isolatedData }) => {
  const { api } = await overdueWeeklySeries(page, isolatedData.apiURL)
  expect((await api(`/families/${ids.family}/recipient-permissions`, { method: 'PATCH', data: { recipientDeletion: 'member' } })).status()).toBe(200)
  await login(page, 'may')
  await overdueBoard(page, isMobile)
  await expect(page.getByRole('button', { name: 'Stop repeating', exact: true })).toHaveCount(0)
})

test('future sessions stay grouped without a three-dot menu after deleting the missed date', async ({ page, isMobile, isolatedData }) => {
  const { api, task } = await overdueWeeklySeries(page, isolatedData.apiURL)
  expect((await api(`${path}/${task._id}`, { method: 'DELETE' })).status()).toBe(200)
  await login(page)
  if (isMobile) await page.getByRole('navigation', { name: 'Mobile home navigation' }).getByRole('button', { name: 'Tasks', exact: true }).click()
  await page.getByRole('button', { name: 'Needs someone', exact: true }).click()
  await expect(page.getByRole('button', { name: `Options for ${task.title}`, exact: true })).toHaveCount(0)
  const rows = page.locator('article').filter({ hasText: task.title }).filter({ visible: true })
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Next session:')
})
