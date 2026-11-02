import { test, expect, login, ids, authenticatedApi } from './fixtures.mjs'

async function openTelegram(page, isMobile) {
  await page.goto('/settings')
  if (isMobile) await page.getByRole('button', { name: 'Manage', exact: true }).click()
  // Both layouts render the same real card; select the visible instance.
  return page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Telegram group', exact: true }),
  }).filter({ visible: true }).last()
}

test('persists Telegram switches and reminders, isolates families and prevents member editing', async ({ page, isMobile, isolatedData }) => {
  await login(page)
  let card = await openTelegram(page, isMobile)
  const posted = card.getByRole('switch', { name: 'A task is posted', exact: true })
  await expect(posted).toBeEnabled()
  await expect(posted).toBeChecked()
  await posted.uncheck()
  await expect(card.getByRole('status')).toHaveText('Telegram preferences saved.')
  await card.getByRole('switch', { name: 'Daily summary at 8am', exact: true }).check()
  await expect(card.getByRole('status')).toHaveText('Reminder preferences saved.')
  await page.reload()
  if (isMobile) await page.getByRole('button', { name: 'Manage', exact: true }).click()
  await expect(posted).not.toBeChecked()
  await expect(card.getByRole('switch', { name: 'Daily summary at 8am', exact: true })).toBeChecked()

  if (isMobile) {
    const dialog = page.getByRole('dialog', { name: 'Telegram updates', exact: true })
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole('button', { name: 'Switch', exact: true }).click()
  } else await page.getByRole('button', { name: /Tan family.*members/ }).click()
  await page.getByRole('button', { name: /Lee family/ }).click()
  card = await openTelegram(page, isMobile)
  await expect(card.getByRole('switch', { name: 'A task is posted', exact: true })).toBeChecked()
  await expect(card.getByRole('switch', { name: 'Daily summary at 8am', exact: true })).not.toBeChecked()
  if (isMobile) {
    const dialog = page.getByRole('dialog', { name: 'Telegram updates', exact: true })
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await expect(dialog).not.toBeVisible()
  }
  await page.getByRole('button', { name: /Log out/ }).click()
  await expect(page).toHaveURL(/\/login$/)
  await login(page, 'may')
  card = await openTelegram(page, isMobile)
  await expect(card.getByRole('switch', { name: 'A task is posted', exact: true })).not.toBeChecked()
  await expect(card.getByRole('switch', { name: 'Daily summary at 8am', exact: true })).toBeChecked()
  const switches = card.getByRole('switch')
  await expect(switches).toHaveCount(8)
  for (const toggle of await switches.all()) await expect(toggle).toBeDisabled()
  // Permissions must also hold for a direct request that bypasses disabled UI.
  const api = await authenticatedApi(page, isolatedData.apiURL, 'may')
  const denied = await api(`/families/${ids.family}/notify-settings`, {
    method: 'PATCH', data: { notifyOn: ['task.created'], reminders: { dailySummary: false } },
  })
  expect(denied.status()).toBe(403)
  const persisted = await (await api(`/families/${ids.family}/notify-settings`)).json()
  expect(persisted.reminders.dailySummary).toBe(true)
  expect(persisted.notifyOn).not.toContain('task.created')
})
