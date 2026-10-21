import { test as base, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { connectTestDatabase, mongoose } from '../../server/test/support/database.js'
import { resetFixtures, ids, accounts, password } from '../../server/test/support/fixtures.js'

export const test = base.extend({
  isolatedData: [async ({ context }, use) => {
    const runtime = JSON.parse(await readFile(new URL('../../.test-runtime/e2e.json', import.meta.url), 'utf8'))
    await connectTestDatabase(runtime.uri)
    await resetFixtures()
    // Decorative Google fonts aren't a dependency of a user workflow.
    await context.route('https://fonts.googleapis.com/**', route => route.abort())
    await context.route('https://fonts.gstatic.com/**', route => route.abort())
    await use({ ids, apiURL: runtime.apiURL })
  }, { auto: true }],
})
test.afterAll(async () => { await mongoose.disconnect() })
export { expect, ids }

export async function login(page, account = 'alex') {
  await page.goto('/login')
  await page.getByLabel('Email address', { exact: true }).fill(accounts[account])
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /Log in/ }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(account === 'alex' ? 'Alex' : 'May')
}
