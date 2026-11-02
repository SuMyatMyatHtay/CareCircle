import { test, expect, login } from './fixtures.mjs'

async function expectContained(page, locator) {
  await expect(locator).toBeVisible()
  const bounds = await locator.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1)
}

test('narrow screens keep tabs, invite codes, calendar and form fields readable', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phone layout regression')
  await login(page)
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/my-tasks')
    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(3)
    for (const tab of await tabs.all()) {
      await expectContained(page, tab)
      expect(await tab.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }

    await page.goto('/settings')
    const code = page.locator('.care-mobile-invite-copy p')
    await expect(code).toHaveText('AABBCCDDEE')
    // A ten-character invitation stays on one line.
    expect(await code.evaluate(el => el.clientHeight <= parseFloat(getComputedStyle(el).lineHeight) + 1)).toBe(true)
    await expect(page.getByRole('link', { name: "View Jasmine's profile", exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Manage Jasmine', exact: true })).toBeVisible()

    await page.goto('/calendar')
    await expectContained(page, page.getByTestId('calendar-month'))
    for (const select of await page.locator('.calendar-filters select').all()) {
      await expectContained(page, select)
    }
    await page.getByTestId('calendar-add-task').click()
    const dialog = page.getByRole('dialog', { name: 'New task', exact: true })
    await expect(dialog).toBeVisible()
    for (const name of ['Cancel', 'Post task']) {
      await expectContained(page, dialog.getByRole('button', { name, exact: true }))
    }
    const body = await dialog.locator('.new-task-body').boundingBox()
    expect(body.height).toBeGreaterThan(100)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).not.toBeVisible()

    await page.goto('/tasks/new')
    const title = page.getByLabel('What needs doing?')
    await expect(title).toBeVisible()
    expect(await title.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    for (const name of ['Starts', 'Ends (optional)']) {
      const input = page.getByLabel(name, { exact: true })
      await input.scrollIntoViewIfNeeded()
      await expectContained(page, input)
    }
    const sizes = await page.locator('.app-main').evaluate(el => ({ content: el.scrollWidth, visible: el.clientWidth }))
    expect(sizes.content).toBeLessThanOrEqual(sizes.visible + 1)
  }
})

test('resizing a phone preserves the drawer until a breakpoint changes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phone drawer regression')
  await login(page)
  await page.goto('/calendar')
  const menu = page.getByRole('button', { name: 'Open navigation menu' })
  await menu.click()
  await expect(page.locator('#family-navigation')).not.toHaveAttribute('inert')
  await page.setViewportSize({ width: 390, height: 500 })
  await expect(page.locator('#family-navigation')).not.toHaveAttribute('inert')
  await page.keyboard.press('Escape')
  await expect(page.locator('#family-navigation')).toHaveAttribute('inert')
  await page.setViewportSize({ width: 768, height: 844 })
  await expect(page.locator('#family-navigation')).not.toHaveAttribute('inert')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('#family-navigation')).toHaveAttribute('inert')
  await expect(menu).toBeVisible()
})

test('the assistant clears the task footer and fits a short phone viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phone assistant regression')
  await login(page)
  await page.goto('/tasks/new')
  const launcher = page.getByRole('button', { name: 'Open CareCircle assistant', exact: true })
  const footer = page.locator('.sticky-footer')
  await expect(footer).toBeVisible()
  const launcherBounds = await launcher.boundingBox()
  const footerBounds = await footer.boundingBox()
  expect(launcherBounds.y + launcherBounds.height).toBeLessThanOrEqual(footerBounds.y)

  await launcher.click()
  const panel = page.getByRole('region', { name: 'CareCircle assistant' })
  for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
    await page.setViewportSize(viewport)
    await expectContained(page, panel)
    const panelBounds = await panel.boundingBox()
    expect(panelBounds.y).toBeGreaterThanOrEqual(0)
    expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(viewport.height)
    const composer = page.getByRole('textbox', { name: 'Message CareCircle assistant' })
    await expectContained(page, composer)
    const composerBounds = await composer.boundingBox()
    expect(composerBounds.y + composerBounds.height).toBeLessThanOrEqual(viewport.height)
  }
  await page.getByRole('button', { name: 'Minimize assistant', exact: true }).click()
  await expect(panel).not.toBeVisible()
  await expect(launcher).toBeFocused()
})
