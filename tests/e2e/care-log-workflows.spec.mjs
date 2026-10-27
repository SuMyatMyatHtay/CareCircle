// Owner: SeungHak (F)
import { test, expect, ids, login, authenticatedApi } from './fixtures.mjs'
import { accounts, password } from '../../server/test/support/fixtures.js'

const logPage = `/recipients/${ids.grandpa}/log`

function cards(page) {
  return page.locator('[data-testid^="log-card-"]')
}

async function postNote(page) {
  const created = page.waitForResponse(response =>
    response.url().endsWith(`/families/${ids.family}/logs`) && response.request().method() === 'POST')
  await page.getByTestId('log-submit').click()
  const response = await created
  expect(response.status()).toBe(201)
  return { request: response.request().postDataJSON(), log: (await response.json()).log }
}

// fixtures.mjs login() looks for "May" in the Home greeting, which reads "Good morning, Aunt"
async function loginAsMember(page) {
  await page.goto('/login')
  await page.getByLabel('Email address', { exact: true }).fill(accounts.may)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /Log in/ }).click()
  await expect(page).toHaveURL(/\/home$/)
}

// A silent tone stands in for the microphone, so MediaRecorder produces a real recording.
async function useFakeMicrophone(page) {
  await page.addInitScript(() => {
    const fakeGetUserMedia = async () => {
      const context = new AudioContext()
      const tone = context.createOscillator()
      const output = context.createMediaStreamDestination()
      tone.connect(output)
      tone.start()
      return output.stream
    }
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {} })
    navigator.mediaDevices.getUserMedia = fakeGetUserMedia
  })
}

test('posts a consultation note, filters, edits and deletes it, and each change survives a reload', async ({ page }) => {
  await login(page)
  await page.goto(logPage)
  await expect(page.getByRole('heading', { name: "Grandpa's care log", exact: true })).toBeVisible()
  await expect(page.getByTestId(`log-card-${ids.log}`)).toContainText('Sample note in the isolated test database.')

  await page.getByTestId('log-submit').click()
  await expect(page.getByText('Please write a short note.', { exact: true })).toBeVisible()

  await page.getByTestId('log-type-consultation').click()
  await page.getByTestId('log-content').fill('Blood pressure is stable. Keep the same diet.')
  await page.getByLabel('Doctor optional', { exact: true }).fill('Dr Lim')
  await page.getByLabel('Clinic optional', { exact: true }).fill('Ang Mo Kio Polyclinic')
  await page.getByTestId('log-notify').uncheck()
  const { request, log } = await postNote(page)

  expect(request).toMatchObject({ type: 'consultation', notify: false, inputMethod: 'text' })
  const card = page.getByTestId(`log-card-${log._id}`)
  await expect(cards(page).first()).toHaveAttribute('data-testid', `log-card-${log._id}`)
  await expect(card).toContainText('Blood pressure is stable. Keep the same diet.')
  await expect(card).toContainText('Ang Mo Kio Polyclinic')
  await expect(card).toContainText('Dr Lim')
  await expect(page.getByTestId('log-content')).toHaveValue('')

  await page.reload()
  await expect(card).toContainText('Blood pressure is stable.')

  await page.getByTestId('log-filter-consultation').click()
  await expect(cards(page)).toHaveCount(1)
  await expect(card).toBeVisible()
  await page.getByTestId('log-filter-general').click()
  await expect(cards(page)).toHaveCount(1)
  await expect(page.getByTestId(`log-card-${ids.log}`)).toBeVisible()
  await page.getByTestId('log-filter-all').click()
  await expect(cards(page)).toHaveCount(2)

  await card.getByRole('button', { name: 'Edit note', exact: true }).click()
  await page.locator(`#log-content-${log._id}`).fill('Blood pressure is stable. Less salt from today.')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(card).toContainText('Less salt from today.')
  await page.reload()
  await expect(card).toContainText('Less salt from today.')

  page.once('dialog', dialog => dialog.accept())
  await card.getByRole('button', { name: 'Delete note', exact: true }).click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId(`log-card-${ids.log}`)).toBeVisible()
  await expect(card).toHaveCount(0)

  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(widths.document).toBeLessThanOrEqual(widths.viewport)
})

test('records a medication change with its details', async ({ page }) => {
  await login(page)
  await page.goto(logPage)
  await page.getByTestId('log-type-medication_change').click()
  await page.getByTestId('log-content').fill('Doctor raised the blood pressure medicine.')
  await page.getByLabel('Medicine 1 name', { exact: true }).fill('Amlodipine')
  await page.getByLabel('Medicine 1 change', { exact: true }).selectOption('dosage_changed')
  await page.getByLabel('Medicine 1 details', { exact: true }).fill('5mg to 10mg, once daily')
  const { request, log } = await postNote(page)

  expect(request.medicationChanges).toEqual([{ name: 'Amlodipine', change: 'dosage_changed', details: '5mg to 10mg, once daily' }])
  const card = page.getByTestId(`log-card-${log._id}`)
  await expect(card).toContainText('Amlodipine')
  await expect(card).toContainText('Dose changed')
  await expect(card).toContainText('5mg to 10mg, once daily')
  await page.getByTestId('log-filter-medication_change').click()
  await expect(cards(page)).toHaveCount(1)
})

test('a member can change only their own notes, but can translate everyone\'s', async ({ page }) => {
  await loginAsMember(page)
  await page.goto(logPage)

  const alexNote = page.getByTestId(`log-card-${ids.log}`)
  await expect(alexNote).toBeVisible()
  await expect(alexNote.getByTestId('log-translate')).toBeVisible()
  await expect(alexNote.getByRole('button', { name: 'Edit note', exact: true })).toHaveCount(0)
  await expect(alexNote.getByRole('button', { name: 'Delete note', exact: true })).toHaveCount(0)

  await page.getByTestId('log-content').fill('Grandpa finished his lunch.')
  const { log } = await postNote(page)
  const ownNote = page.getByTestId(`log-card-${log._id}`)
  await expect(ownNote.getByRole('button', { name: 'Edit note', exact: true })).toBeVisible()
  await expect(ownNote.getByRole('button', { name: 'Delete note', exact: true })).toBeVisible()
})

test('voice input explains when the server has no speech service', async ({ page }) => {
  await useFakeMicrophone(page)
  await login(page)
  await page.goto(logPage)

  // The isolated test server never has GROQ_API_KEY, so this is the real 503 reply
  const transcribed = page.waitForResponse(response => response.url().endsWith('/integrations/transcribe'))
  await page.getByRole('button', { name: 'Speak your note', exact: true }).click()
  await expect(page.getByText(/Listening/)).toBeVisible()
  await page.getByRole('button', { name: 'Stop and use what I said', exact: true }).click()
  expect((await transcribed).status()).toBe(503)
  await expect(page.getByText('Voice input is not set up on the server.', { exact: true })).toBeVisible()
  await expect(page.getByTestId('log-content')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Speak your note', exact: true })).toBeEnabled()
})

test('a transcribed voice note is added to the text and saved as voice input', async ({ page, isolatedData }) => {
  await useFakeMicrophone(page)
  // Groq is a paid external service, so only the transcription reply is replaced.
  // The recording is still made in the browser and the note is saved by the real API.
  let uploadedType = ''
  await page.route('**/integrations/transcribe', route => {
    uploadedType = route.request().headers()['content-type']
    return route.fulfill({ json: { text: 'Grandpa walked to the park today.' } })
  })
  await login(page)
  await page.goto(logPage)

  await page.getByTestId('log-content').fill('Morning update:')
  await page.getByRole('button', { name: 'Speak your note', exact: true }).click()
  await page.getByRole('button', { name: 'Stop and use what I said', exact: true }).click()
  await expect(page.getByTestId('log-content')).toHaveValue('Morning update: Grandpa walked to the park today.')
  await expect(page.getByText('Added from voice. Check the text before posting.', { exact: true })).toBeVisible()
  expect(uploadedType).toMatch(/^audio\//)

  const { request, log } = await postNote(page)
  expect(request.inputMethod).toBe('voice')
  await expect(page.getByTestId(`log-card-${log._id}`)).toContainText('voice note')

  const api = await authenticatedApi(page, isolatedData.apiURL)
  const saved = await api(`/families/${ids.family}/logs/${log._id}`)
  expect(saved.status()).toBe(200)
  expect((await saved.json()).log).toMatchObject({ inputMethod: 'voice', content: 'Morning update: Grandpa walked to the park today.' })
})

test('"Add consultation note" on a task opens a pop-up and saves the note to that visit', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone task page has no notes card yet')
  await login(page)
  const taskPage = `/families/${ids.family}/tasks/${ids.task}`
  await page.goto(taskPage)
  await expect(page.getByText('No notes yet.', { exact: false })).toBeVisible()

  await page.getByTestId('task-add-note').click()
  const dialog = page.getByRole('dialog', { name: 'Add consultation note' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByTestId('task-add-note').click()
  await dialog.getByTestId('log-content').fill('Doctor says the new tablets are working.')
  const { request, log } = await postNote(page)
  expect(request).toMatchObject({ type: 'consultation', recipient: ids.grandpa, task: ids.task })

  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`${taskPage}$`))
  await expect(page.getByTestId('saved-toast')).toHaveText("Note saved to Grandpa's log")
  const visitNotes = page.getByTestId('visit-notes')
  const newNote = visitNotes.getByTestId(`log-card-${log._id}`)
  await expect(newNote).toContainText('Doctor says the new tablets are working.')
  await expect(page.getByTestId('saved-toast')).toHaveCount(0, { timeout: 6000 })

  // Same cards as the Log page: translate, edit and delete work here too
  await newNote.getByTestId('log-translate').click()
  await newNote.getByTestId('log-translate-zh').click()
  await expect(newNote.locator('.translation')).toBeVisible()

  await newNote.getByRole('button', { name: 'Edit note', exact: true }).click()
  await visitNotes.locator(`#log-content-${log._id}`).fill('Doctor says the tablets are working. Review in 2 weeks.')
  await visitNotes.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(newNote).toContainText('Review in 2 weeks.')

  await page.goto(logPage)
  await expect(cards(page).first()).toContainText('Review in 2 weeks.')

  await page.goto(taskPage)
  page.once('dialog', dialog => dialog.accept())
  await newNote.getByRole('button', { name: 'Delete note', exact: true }).click()
  await expect(newNote).toHaveCount(0)
  await expect(page.getByText('No notes yet.', { exact: false })).toBeVisible()
})
