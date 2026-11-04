// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { startTask } from '../services/myTasksApi.js'
import { http } from '../../../services/http.js'
vi.mock('../../../services/http.js', () => ({ http: { post: vi.fn() } }))
const change = { scheduledStartAt: '2026-11-10T02:00:00.000Z', proposedStartAt: '2026-11-04T02:00:00.000Z', expectedUpdatedAt: '2026-11-01T00:00:00.000Z' }
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks() })
it('asks before retrying a different-day start with the confirmed schedule', async () => {
  sessionStorage.setItem('token', 'test')
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  http.post.mockRejectedValueOnce({ response: { status: 409, data: { startDateChange: change } } }).mockResolvedValueOnce({ data: { task: { _id: 'task', status: 'in_progress' } } })
  await startTask('family', 'task')
  expect(confirm.mock.calls[0][0]).toContain('move this session to the current date and time')
  expect(http.post).toHaveBeenLastCalledWith('/families/family/tasks/task/start', { confirmedScheduledStartAt: change.scheduledStartAt, expectedUpdatedAt: change.expectedUpdatedAt }, expect.any(Object))
})
it('does not retry or change anything when the user cancels', async () => {
  sessionStorage.setItem('token', 'test')
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  http.post.mockRejectedValueOnce({ response: { status: 409, data: { startDateChange: change } } })
  await expect(startTask('family', 'task')).rejects.toThrow('Trip start cancelled')
  expect(http.post).toHaveBeenCalledTimes(1)
})
