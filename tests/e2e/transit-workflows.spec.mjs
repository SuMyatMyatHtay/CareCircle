// Owner: Chaithra (E) · Week 10c: E2E tests for My Tasks & Transit
// Real Vue app + Axios + Express + login + isolated MongoDB, on desktop and phone sizes.
// Uses SangYoon's E2E setup (tests/e2e/fixtures.mjs). Outside services are switched off:
// OneMap map pictures and the OSRM road lookup aren't part of these workflows.
import { test as base, expect } from './fixtures.mjs'
import { accounts, password } from '../../server/test/support/fixtures.js'
import { resetTransitFixtures, transitIds as ids, TTSH } from '../../server/test/support/transit-fixtures.js'

const test = base.extend({
  tripData: [async ({ isolatedData, context }, use) => {
    await resetTransitFixtures() // adds "Physio at TTSH", claimed by Alex and needing transit
    await context.route('https://www.onemap.gov.sg/**', route => route.abort())
    await context.route('https://router.project-osrm.org/**', route => route.abort())
    await use({ ...isolatedData, ids })
  }, { auto: true }],
})

async function login(page, who) {
  await page.goto('/login')
  await page.getByLabel('Email address', { exact: true }).fill(accounts[who])
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /Log in/ }).click()
  await expect(page).toHaveURL(/\/home$/)
}

// Steps on the trip's timeline (desktop list or phone checklist), in order
function timeline(page) {
  return page.locator('.updates li strong, .steps li.done strong')
}

async function openMyTripAndStart(page) {
  await page.goto('/my-tasks')
  const card = page.getByText('Physio at TTSH', { exact: true }).filter({ visible: true })
  await expect(card).toBeVisible()
  const start = page.getByRole('button', { name: 'Start the trip', exact: true })
  // Laptop: the first card is already open. Phone: tapping it opens the task's page.
  if (!(await start.isVisible())) await card.click()
  await start.click()
  await expect(page).toHaveURL(new RegExp(`/transit/${ids.family}/${ids.tripTask}$`))
  // Laptop badge says "● Live", the phone header says "Live"
  await expect(page.getByText(/^(● )?Live$/).filter({ visible: true }).first()).toBeVisible()
}

async function postOwnUpdate(page, text) {
  const box = page.getByLabel('Your own update', { exact: true })
  await box.fill(text)
  await box.press('Enter')
  await expect(timeline(page).filter({ hasText: text })).toHaveCount(1)
}

test('the companion starts a trip from My Tasks, posts updates and they survive a reload', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: TTSH.lat, longitude: TTSH.lng })
  await login(page, 'alex')
  await openMyTripAndStart(page)

  await page.getByRole('button', { name: 'Departed home', exact: true }).click()
  await expect(timeline(page).first()).toHaveText('Departed home')
  await postOwnUpdate(page, 'Stuck in traffic on PIE')

  await page.reload()
  await expect(timeline(page)).toHaveText(['Departed home', 'Stuck in traffic on PIE'])
  // The location sharing note shows only to the person on the trip
  await expect(page.getByText(/Sharing your location with the family/)).toBeVisible()
})

test('the companion removes a wrong update with × and it stays removed', async ({ page }) => {
  await login(page, 'alex')
  await openMyTripAndStart(page)
  await postOwnUpdate(page, 'asdfgh')

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Remove asdfgh', exact: true }).click()
  await expect(timeline(page).filter({ hasText: 'asdfgh' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Post the next update', { exact: true })).toBeVisible()
  await expect(timeline(page).filter({ hasText: 'asdfgh' })).toHaveCount(0)
})

test('"Safely back home" ends the trip and the task shows as done in My Tasks', async ({ page }) => {
  await login(page, 'alex')
  await openMyTripAndStart(page)
  await page.getByRole('button', { name: 'Departed home', exact: true }).click()
  await expect(timeline(page)).toHaveCount(1)

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: /safely back home/i }).last().click()
  await expect(page.getByText('Ended', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText(/safely back home\. The task is (marked as )?done\./i)).toBeVisible()
  await expect(page.getByLabel('Your own update', { exact: true })).toHaveCount(0)

  await page.goto('/my-tasks')
  await page.getByRole('tab', { name: /^Done · 1/ }).filter({ visible: true }).click()
  await expect(page.getByText('Physio at TTSH', { exact: true }).filter({ visible: true })).toBeVisible()
})

test('another family member sees the live trip on Family Home and can only follow', async ({ page, request, tripData }) => {
  // Alex starts the trip and posts one update through the real API
  const loginAlex = await request.post(`${tripData.apiURL}/auth/login`, { data: { email: accounts.alex, password } })
  const auth = { Authorization: `Bearer ${(await loginAlex.json()).token}` }
  const task = `${tripData.apiURL}/families/${ids.family}/tasks/${ids.tripTask}`
  expect((await request.post(`${task}/start`, { headers: auth })).ok()).toBe(true)
  expect((await request.post(`${task}/transit/milestones`, { headers: auth, data: { type: 'departed' } })).ok()).toBe(true)

  await login(page, 'jasmine')
  // Laptop and phone each have their own banner; only the one for this screen size is visible
  await expect(page.getByText(/Grandpa is on the way to Tan Tock Seng Hospital/).filter({ visible: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /View live|Grandpa is on the way/ }).filter({ visible: true }).first().click()

  await expect(page).toHaveURL(new RegExp(`/transit/${ids.family}/${ids.tripTask}$`))
  await expect(timeline(page)).toHaveText(['Departed home'])
  await expect(page.getByText(/Only Alex can post updates/)).toBeVisible()
  await expect(page.getByLabel('Your own update', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(0)
})

test('a family member who did not claim the task cannot start its trip', async ({ page }) => {
  await login(page, 'jasmine')
  await page.goto(`/transit/${ids.family}/${ids.tripTask}`)
  await expect(page.getByText(/Transit (starts when Alex|not started yet)/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the trip', exact: true })).toHaveCount(0)
})
