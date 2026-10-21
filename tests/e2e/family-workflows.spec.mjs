import { test, expect, ids, login } from './fixtures.mjs'

test('invalid login, successful login, logout and protected-page redirect', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email address', { exact: true }).fill('alex@carecircle.test')
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password')
  await page.getByRole('button', { name: /Log in/ }).click()
  await expect(page.getByText('Incorrect email or password. Please try again.')).toBeVisible()
  await login(page)
  await page.goto('/settings')
  await page.getByRole('button', { name: /Log out/ }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/home')
  await expect(page).toHaveURL(/\/login$/)
})

test('language selection stays visible while saving and survives reload', async ({ page, isMobile }) => {
  await login(page)
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: 'Manage Jasmine', exact: true })).toBeVisible()
  let release, started
  const gate = new Promise(resolve => { release = resolve })
  const saving = new Promise(resolve => { started = resolve })
  // Pause only timing. The request and response still go through the real API
  // and MongoDB; no backend data is mocked or fulfilled by this test.
  await page.route('**/auth/me', async route => {
    if (route.request().method() === 'PATCH') { started(); await gate }
    await route.continue()
  })
  try {
    if (isMobile) await page.getByLabel('Notes language', { exact: true }).selectOption('zh')
    else await page.getByRole('button', { name: '中文', exact: true }).click()
    await saving
    if (isMobile) await expect(page.getByLabel('Notes language', { exact: true })).toHaveValue('zh')
    else await expect(page.getByRole('button', { name: '中文', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Manage Jasmine', exact: true })).toBeVisible()
    await expect(page.getByText('Loading family members…', { exact: true })).not.toBeVisible()
    await expect(page).toHaveURL(/\/settings$/)
  } finally { release() }
  await expect(page.getByText('Your language preference has been saved.', { exact: true }).filter({ visible: true })).toBeVisible()
  await page.reload()
  if (isMobile) await expect(page.getByLabel('Notes language', { exact: true })).toHaveValue('zh')
  else await expect(page.getByRole('button', { name: '中文', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('dark mode applies across pages and after a full reload', async ({ page }) => {
  await login(page)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  for (const path of ['/my-tasks', `/recipients/${ids.grandpa}`, '/profile']) {
    await page.goto(path)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark')
    await expect(page.locator('.app-layout')).toHaveCSS('background-color', 'rgb(20, 26, 23)')
  }
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(widths.document).toBeLessThanOrEqual(widths.viewport)
})

test('creates, edits and archives a recipient through the real application', async ({ page }) => {
  await login(page)
  await page.goto('/recipients/new')
  await page.getByLabel('Full name', { exact: true }).fill('E2E Care Recipient')
  await page.getByRole('button', { name: 'Elderly', exact: true }).click()
  await page.getByLabel('Care notes', { exact: true }).fill('Initial care note')
  await page.getByRole('button', { name: 'Save recipient', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'E2E Care Recipient', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit care recipient' })
  await dialog.getByLabel('Care notes', { exact: true }).fill('Bring the walking frame')
  await dialog.getByRole('button', { name: 'Save recipient', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page.getByText('Bring the walking frame', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Bring the walking frame', { exact: true })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Archive recipient', exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
  await page.reload()
  await expect(page.getByText('E2E Care Recipient', { exact: true })).toHaveCount(0)
})

test('creates and claims a family task, then isolates the selected family', async ({ page, isMobile }) => {
  await login(page)
  await page.goto('/tasks/new')
  await page.getByRole('button', { name: /Grandpa/ }).click()
  await page.getByLabel('What needs doing?', { exact: true }).fill('E2E grocery pickup')
  await page.getByLabel('Starts', { exact: true }).fill('23:30')
  await page.getByRole('button', { name: 'Post task', exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
  const task = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'E2E grocery pickup', exact: true }) })
  await task.getByRole('button', { name: 'I’ll take it', exact: true }).click()
  await expect(task).toContainText('Claimed')
  await page.reload()
  await expect(task).toContainText('Claimed')
  await expect(task).toContainText('Alex Tan')
  await page.goto('/settings')
  if (isMobile) await page.getByRole('button', { name: 'Switch', exact: true }).click()
  else await page.getByRole('button', { name: /Tan family.*members/ }).click()
  await page.getByRole('button', { name: /Lee family/ }).click()
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'E2E grocery pickup', exact: true })).toHaveCount(0)
  if (isMobile) {
    await page.getByRole('button', { name: 'People', exact: true }).click()
    await expect(page.getByRole('button', { name: /Lee recipient/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Grandpa/ })).toHaveCount(0)
  } else {
    await expect(page.getByRole('heading', { name: 'Lee recipient', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Grandpa', exact: true })).toHaveCount(0)
  }
})

test('manages roles, protects the last admin and persists a regenerated invitation', async ({ page, isMobile }) => {
  await login(page)
  await page.goto('/settings')
  const jasmine = page.getByRole('button', { name: 'Manage Jasmine', exact: true })
  await jasmine.click()
  if (!isMobile) {
    await expect(page.getByRole('button', { name: 'Change to member', exact: true })).toBeVisible()
    await page.getByRole('heading', { name: 'Family settings', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Change to member', exact: true })).toHaveCount(0)
    await jasmine.click()
  }
  await page.getByRole('button', { name: 'Change to member', exact: true }).click()
  await expect(page.getByRole('listitem').filter({ has: jasmine })).toContainText('Member')
  await page.getByRole('button', { name: isMobile ? 'Manage Alex Tan (you)' : 'Manage Alex Tan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Change to member', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Leave family', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: isMobile ? 'Close dialog' : 'Close', exact: true }).click()
  const invitation = page.getByRole('region', { name: isMobile ? 'Family invite code' : 'Invite code', exact: true })
  await expect(invitation).toContainText('AABBCCDDEE')
  await page.getByRole('button', { name: isMobile ? 'Regenerate invite code' : 'Regenerate', exact: true }).click()
  const response = page.waitForResponse(response => response.url().endsWith('/invite-code') && response.request().method() === 'POST')
  await page.getByRole('dialog').getByRole('button', { name: 'Regenerate code', exact: true }).click()
  const saved = await (await response).json()
  expect(saved.inviteCode).toMatch(/^[A-F0-9]{10}$/)
  expect(saved.inviteCode).not.toBe('AABBCCDDEE')
  await expect(invitation).toContainText(saved.inviteCode)
  await page.reload()
  await expect(invitation).toContainText(saved.inviteCode)
})
