import { test, expect, ids, login } from './fixtures.mjs'

test('new account registers and creates a family as its admin', async ({ page, isolatedData }) => {
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('Audit Caregiver')
  await page.getByLabel('Email address').fill('browser-audit@carecircle.test')
  await page.getByLabel('Password', { exact: false }).first().fill('Browser-audit-only-123')
  await page.getByLabel('Confirm password').fill('Browser-audit-only-123')
  await page.getByRole('checkbox', { name: /I understand/ }).check()
  await page.getByRole('button', { name: 'Create account', exact: false }).click()
  await expect(page).toHaveURL(/\/home$/)
  await page.goto('/create-family')
  await page.getByLabel('What should we call your family?').fill('Browser audit family')
  await page.getByRole('button', { name: /Create my family/ }).click()
  await expect(page.getByRole('heading', { name: /Your circle is ready/ })).toBeVisible()
  const token = await page.evaluate(() => sessionStorage.getItem('token'))
  const response = await page.request.get(`${isolatedData.apiURL}/families/mine`, { headers: { Authorization: `Bearer ${token}` } })
  expect(response.status()).toBe(200)
  const families = (await response.json()).families
  expect(families).toHaveLength(1)
  expect(families[0].members[0].role).toBe('admin')
  expect(families[0].recipientDeletion).toBe('admin')
})

test('profile edits persist and authenticated feature pages render without browser exceptions', async ({ page }) => {
  const exceptions = []
  page.on('pageerror', error => exceptions.push(error.message))
  await login(page)
  await page.goto('/profile')
  await page.getByRole('button', { name: /Edit$/ }).click()
  await page.getByLabel('Full name', { exact: true }).fill('Alex Audit')
  await page.getByLabel('Phone number', { exact: true }).fill('91234567')
  await page.getByRole('button', { name: /Save changes/ }).click()
  await expect(page.getByLabel('Full name', { exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Alex Audit')
  await expect(page.getByLabel('Phone number', { exact: true })).toHaveValue('91234567')
  for (const path of [`/profile/${ids.jasmine}`, '/contributions', '/search?q=medicine', '/avatar-studio', '/dress-up', `/recipients/${ids.grandpa}`, `/recipients/${ids.grandpa}/profile`, `/recipients/${ids.grandpa}/tasks`, `/recipients/${ids.grandpa}/log`]) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByRole('heading').first()).toBeVisible()
    expect(exceptions, `Browser exceptions while visiting ${path}`).toEqual([])
  }
})
