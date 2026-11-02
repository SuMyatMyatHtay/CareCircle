import { test, expect, ids, login, authenticatedApi } from './fixtures.mjs'

async function openOverdue(page, isMobile) {
  await page.goto('/home')
  if (isMobile) await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await page.getByRole('button', { name: 'Overdue', exact: true }).filter({ visible: true }).click()
}

test('enforces deletion permission and deletes only the selected overdue task after confirmation', async ({ page, isMobile, isolatedData }) => {
  const api = await authenticatedApi(page, isolatedData.apiURL)
  const root = `/families/${ids.family}`
  const taskIds = []
  for (const [title, offset] of [['Overdue selected', -86400000], ['Overdue preserved', -86400000], ['Future preserved', 86400000]]) {
    const response = await api(`${root}/tasks`, { method: 'POST', data: {
      title, recipient: ids.grandpa, category: 'errand', startAt: new Date(Date.now() + offset).toISOString(),
    } })
    expect(response.status()).toBe(201)
    taskIds.push((await response.json()).task._id)
  }

  await login(page, 'may')
  await openOverdue(page, isMobile)
  await expect(page.getByRole('button', { name: /Delete selected/ }).filter({ visible: true })).toHaveCount(0)
  const memberApi = await authenticatedApi(page, isolatedData.apiURL, 'may')
  const denied = await memberApi(`${root}/tasks/overdue`, { method: 'DELETE', data: { taskIds: [taskIds[0]] } })
  expect(denied.status()).toBe(403)
  await page.goto('/settings')
  await page.getByRole('button', { name: /Log out/ }).click()
  await expect(page).toHaveURL(/\/login$/)

  await login(page)
  await page.goto('/settings')
  const permission = page.getByRole('radio', { name: /All family members/ }).filter({ visible: true })
  await permission.check()
  await expect(page.getByText('Task permissions saved.', { exact: true }).filter({ visible: true })).toBeVisible()
  await page.getByRole('button', { name: /Log out/ }).click()
  await expect(page).toHaveURL(/\/login$/)
  await login(page, 'may')
  await openOverdue(page, isMobile)
  const remove = page.getByRole('button', { name: 'Delete selected', exact: true }).filter({ visible: true })
  await expect(remove).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Select Overdue selected for deletion', exact: true }).filter({ visible: true }).check()
  const selected = page.getByRole('button', { name: 'Delete selected (1)', exact: true }).filter({ visible: true })
  let confirmation
  page.once('dialog', async dialog => { confirmation = dialog.message(); await dialog.dismiss() })
  await selected.click()
  expect(confirmation).toContain('Delete 1 selected overdue task?')
  await expect(selected).toBeEnabled()
  await expect(page.getByRole('checkbox', { name: 'Select Overdue selected for deletion', exact: true }).filter({ visible: true })).toBeChecked()

  page.once('dialog', dialog => dialog.accept())
  const deleted = page.waitForResponse(res => res.url().endsWith('/tasks/overdue') && res.request().method() === 'DELETE')
  await selected.click()
  const result = await deleted
  expect(result.status()).toBe(200)
  expect((await result.json()).deletedCount).toBe(1)
  await expect(page.getByText('1 overdue task deleted.', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Select Overdue selected for deletion', exact: true })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Select Overdue preserved for deletion', exact: true }).filter({ visible: true })).toBeVisible()
  await openOverdue(page, isMobile)
  await expect(page.getByRole('checkbox', { name: 'Select Overdue selected for deletion', exact: true })).toHaveCount(0)
  // Alex's setup token was revoked by logout; read with the current member.
  const currentApi = await authenticatedApi(page, isolatedData.apiURL, 'may')
  const remainingResponse = await currentApi(`${root}/tasks`)
  expect(remainingResponse.status()).toBe(200)
  const remaining = await remainingResponse.json()
  expect(remaining.tasks.map(task => task._id)).toEqual(expect.arrayContaining(taskIds.slice(1)))
  expect(remaining.tasks.map(task => task._id)).not.toContain(taskIds[0])
})
