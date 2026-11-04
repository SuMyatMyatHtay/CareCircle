import { expect } from '@playwright/test'

// Future fixtures can cross Singapore midnight. Confirm the server's exact
// scheduled date and version rather than bypassing its rescheduling guard.
export async function startTripWithDateConfirmation(send) {
  let response = await send({})
  if (response.status() === 409) {
    const { startDateChange } = await response.json()
    expect(startDateChange).toBeTruthy()
    expect(startDateChange.scheduledStartAt).toBeTruthy()
    expect(startDateChange.expectedUpdatedAt).toBeTruthy()
    response = await send({
      confirmedScheduledStartAt: startDateChange.scheduledStartAt,
      expectedUpdatedAt: startDateChange.expectedUpdatedAt,
    })
  }
  expect(response.status()).toBe(200)
  return response
}
