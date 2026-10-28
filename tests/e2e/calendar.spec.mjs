// Owner: SeungHak (F). Family Calendar: tasks and follow-up appointments on one month grid.
import { test, expect, ids, login, authenticatedApi } from './fixtures.mjs'

// Tomorrow in Singapore, so the test doesn't depend on the time of day it runs
function tomorrow() {
  const day = new Date(Date.now() + 24 * 3600e3).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  return { day, at: hour => `${day}T${String(hour).padStart(2, '0')}:00:00+08:00` }
}

async function openDay(page, day) {
  await page.goto('/calendar')
  const thisMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }).slice(0, 7)
  if (day.slice(0, 7) > thisMonth) await page.getByRole('button', { name: 'Next month' }).click()
  if (day.slice(0, 7) < thisMonth) await page.getByRole('button', { name: 'Previous month' }).click()
  await page.getByTestId(`calendar-day-${day}`).click()
  return page.getByTestId('calendar-agenda')
}

test('shows the family\'s tasks and follow-up appointments, and filters by person', async ({ page, isolatedData }) => {
  await login(page)
  const api = await authenticatedApi(page, isolatedData.apiURL)
  const root = `/families/${ids.family}`
  const { day, at } = tomorrow()

  const grandpaTask = await api(`${root}/tasks`, { method: 'POST', data: { title: 'Physio session', recipient: ids.grandpa, category: 'therapy', startAt: at(10) } })
  expect(grandpaTask.status()).toBe(201)
  const taskId = (await grandpaTask.json()).task._id
  expect((await api(`${root}/tasks/${taskId}/claim`, { method: 'POST' })).status()).toBe(200)
  expect((await api(`${root}/tasks`, { method: 'POST', data: { title: 'Buy groceries', category: 'groceries', startAt: at(9) } })).status()).toBe(201)
  expect((await api(`${root}/logs`, { method: 'POST', data: {
    recipient: ids.grandpa, type: 'consultation', content: 'Check-up went well.', notify: false,
    consultation: { doctorName: 'Dr Lim', clinic: 'AMK Polyclinic', nextAppointment: at(15) },
  } })).status()).toBe(201)

  const agenda = await openDay(page, day)
  const items = agenda.locator('.agenda-item')
  await expect(items).toHaveCount(3)
  // Sorted by time, each with who it's for and its state
  await expect(items.nth(0)).toContainText('Buy groceries')
  await expect(items.nth(0)).toContainText('Household')
  await expect(items.nth(0)).toContainText('Needs someone')
  await expect(items.nth(1)).toContainText('Physio session')
  await expect(items.nth(1)).toContainText('Claimed by Alex')
  await expect(items.nth(2)).toContainText('Follow-up with Dr Lim, AMK Polyclinic')
  await expect(items.nth(2)).toContainText('Next appointment')

  // Only Grandpa's
  await page.getByTestId('calendar-filter').selectOption(ids.grandpa)
  await expect(items).toHaveCount(2)
  await expect(agenda).not.toContainText('Buy groceries')

  // A task opens its detail page
  await items.filter({ hasText: 'Physio session' }).click()
  await expect(page).toHaveURL(new RegExp(`/families/${ids.family}/tasks/${taskId}$`))
})

test('the Calendar opens from Home, and the month can be changed', async ({ page, isMobile }) => {
  await login(page)
  // Desktop: the sidebar. Phones: the calendar button beside the profile picture on Home.
  if (isMobile) await page.getByRole('link', { name: 'Open the family calendar' }).click()
  else await page.getByRole('link', { name: 'Calendar', exact: true }).click()
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()

  const month = page.getByTestId('calendar-month')
  const current = await month.textContent()
  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(month).not.toHaveText(current)
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(month).toHaveText(current)

  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(widths.document).toBeLessThanOrEqual(widths.viewport)
})

test('adds a task straight onto a day, like Apple Calendar', async ({ page, isMobile }) => {
  await login(page)
  // Five days ahead: not one of the form's quick chips, so the picked date must carry over
  const day = new Date(Date.now() + 5 * 24 * 3600e3).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  await openDay(page, day)

  // Desktop: double-click the day. Phones: "+ Add task" in the day's list.
  if (isMobile) await page.getByTestId('calendar-add-task').click()
  else await page.getByTestId(`calendar-day-${day}`).dblclick()

  const dialog = page.getByRole('dialog', { name: 'New task' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Date')).toHaveValue(day)
  await dialog.getByLabel('What needs doing?').fill('Bring Grandpa to the dentist')
  await dialog.getByLabel('Starts').fill('09:30')
  await dialog.getByRole('button', { name: 'Post task' }).click()
  await expect(dialog).toHaveCount(0)

  const agenda = page.getByTestId('calendar-agenda')
  await expect(agenda.locator('.agenda-item').filter({ hasText: 'Bring Grandpa to the dentist' })).toContainText('9:30am')

  // Yesterday can't take new tasks
  const yesterday = new Date(Date.now() - 24 * 3600e3).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  await openDay(page, yesterday)
  await expect(page.getByTestId('calendar-add-task')).toHaveCount(0)
})
