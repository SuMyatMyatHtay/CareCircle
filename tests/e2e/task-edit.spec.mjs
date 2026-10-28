// Owner: SeungHak (F), for D's task form. Edit on Task detail opens the task form filled in.
import { test, expect, ids, authenticatedApi } from './fixtures.mjs'
import { accounts, password } from '../../server/test/support/fixtures.js'

const taskPage = `/families/${ids.family}/tasks/${ids.task}`

// fixtures.mjs login() only knows Alex and May; Jasmine created the fixture task
async function loginAsJasmine(page) {
  await page.goto('/login')
  await page.getByLabel('Email address', { exact: true }).fill(accounts.jasmine)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /Log in/ }).click()
  await expect(page).toHaveURL(/\/home$/)
}

// Phones keep Edit in the "More" menu
async function openMenu(page, isMobile) {
  if (isMobile) await page.getByRole('button', { name: 'More' }).click()
}

test('the task creator edits a task from Task detail and the change is saved', async ({ page, isMobile, isolatedData }) => {
  await loginAsJasmine(page)
  await page.goto(taskPage)
  await openMenu(page, isMobile)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Edit task' })
  await expect(dialog).toBeVisible()
  const title = dialog.getByLabel('What needs doing?')
  await expect(title).toHaveValue('Collect medicine')
  await expect(dialog.getByLabel('Start')).toHaveValue('14:00')

  await title.fill('Collect eye drops')
  const saved = page.waitForResponse(r => r.url().endsWith(`/tasks/${ids.task}`) && r.request().method() === 'PATCH')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  expect((await saved).status()).toBe(200)

  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('saved-toast')).toHaveText('Task updated')
  await expect(page.getByText('Collect eye drops').first()).toBeVisible()

  // Saved on the server, start time unchanged
  const api = await authenticatedApi(page, isolatedData.apiURL, 'jasmine')
  const task = (await (await api(`/families/${ids.family}/tasks/${ids.task}`)).json()).task
  expect(task.title).toBe('Collect eye drops')
  expect(new Date(task.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })).toBe('14:00')
})

test('someone who did not create the task gets no Edit button', async ({ page, isMobile }) => {
  await page.goto('/login')
  await page.getByLabel('Email address', { exact: true }).fill(accounts.alex)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /Log in/ }).click()
  await expect(page).toHaveURL(/\/home$/)
  await page.goto(taskPage)
  await expect(page.getByText('Collect medicine').first()).toBeVisible()
  await openMenu(page, isMobile)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
})
