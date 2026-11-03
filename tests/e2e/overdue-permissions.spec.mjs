import { test, expect, ids, login, authenticatedApi } from './fixtures.mjs'
const family = `/families/${ids.family}`
async function seedOverdue(page, apiURL) {
  const api = await authenticatedApi(page, apiURL)
  const tasks = []
  for (const title of ['Audit overdue one', 'Audit overdue two']) {
    const response = await api(`${family}/tasks`, { method: 'POST', data: { title, startAt: new Date(Date.now() - 86400000).toISOString() } })
    expect(response.status()).toBe(201)
    tasks.push((await response.json()).task)
  }
  return { api, tasks }
}
async function openOverdue(page, isMobile) {
  if (isMobile) await page.getByRole('navigation', { name: 'Mobile home navigation' }).getByRole('button', { name: 'Tasks', exact: true }).click()
  await page.getByRole('button', { name: 'Overdue', exact: true }).click()
}
test('admin selects overdue tasks outside their cards and gets one deletion summary', async ({ page, isMobile, isolatedData }) => {
  const { api, tasks } = await seedOverdue(page, isolatedData.apiURL)
  await login(page)
  await openOverdue(page, isMobile)
  await page.getByRole('checkbox', { name: 'Select Audit overdue one for deletion', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Select Audit overdue two for deletion', exact: true }).check()
  const checkbox = page.getByRole('checkbox', { name: 'Select Audit overdue one for deletion', exact: true })
  expect(await checkbox.evaluate(input => Boolean(input.closest('.task-item, .care-mobile-task')))).toBe(false)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete selected (2)', exact: true }).click()
  await expect(page.getByText('2 overdue tasks deleted.', { exact: true })).toBeVisible()
  for (const task of tasks) expect((await api(`${family}/tasks/${task._id}`)).status()).toBe(404)
  const notes = (await (await api(`${family}/notifications`)).json()).notifications
  expect(notes.filter(note => note.eventType === 'task.deleted').map(note => note.text)).toEqual(['Alex deleted 2 overdue tasks.'])
})
test('member deletion controls follow the saved permission and server rejects disallowed deletion', async ({ page, isMobile, isolatedData }) => {
  const { api, tasks } = await seedOverdue(page, isolatedData.apiURL)
  await login(page, 'may')
  await openOverdue(page, isMobile)
  await expect(page.getByRole('checkbox', { name: /Select Audit overdue/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Delete selected/ })).toBeDisabled()
  const memberApi = await authenticatedApi(page, isolatedData.apiURL, 'may')
  expect((await memberApi(`${family}/tasks/overdue`, { method: 'DELETE', data: { taskIds: [tasks[0]._id] } })).status()).toBe(200)
  expect((await api(`${family}/recipient-permissions`, { method: 'PATCH', data: { recipientDeletion: 'member' } })).status()).toBe(200)
  await page.reload()
  await openOverdue(page, isMobile)
  await expect(page.getByRole('checkbox', { name: 'Select Audit overdue one for deletion', exact: true })).toHaveCount(0)
})
test('task permission settings persist for admin and are disabled for members', async ({ page, isolatedData }) => {
  await login(page)
  await page.goto('/settings')
  const card = page.locator('.care-task-permissions').filter({ visible: true })
  await card.getByRole('radio', { name: /All family members/ }).check()
  await expect(card.getByText('Recipient permissions saved.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(card.getByRole('radio', { name: /All family members/ })).toBeChecked()
  const api = await authenticatedApi(page, isolatedData.apiURL)
  expect((await (await api('/families/mine')).json()).families.find(f => f.id === ids.family).recipientDeletion).toBe('member')
  await page.evaluate(() => sessionStorage.clear())
  await login(page, 'may')
  await page.goto('/settings')
  await expect(card.getByRole('radio', { name: /All family members/ })).toBeDisabled()
})
