// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { http } from '../../../services/http.js'
import { sendAssistantMessage } from '../services/assistantApi.js'

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear() })

it('reports complete retry events once across partial network chunks and returns the final reply', async () => {
  sessionStorage.setItem('token', 'test-token')
  const onRetry = vi.fn()
  const first = JSON.stringify({ type: 'retry', retry: 1, maxRetries: 5 }) + '\n'
  const second = JSON.stringify({ type: 'retry', retry: 2, maxRetries: 5 }) + '\n'
  const final = JSON.stringify({ type: 'result', data: { message: 'Hello' } }) + '\n'
  vi.spyOn(http, 'post').mockImplementation(async (url, body, options) => {
    expect(options.headers.Accept).toBe('application/x-ndjson')
    for (const text of [first.slice(0, 10), first + second.slice(0, 8), first + second]) {
      options.onDownloadProgress({ event: { target: { responseText: text } } })
    }
    return { data: first + second + final }
  })
  expect(await sendAssistantMessage('family', [], undefined, {}, onRetry)).toEqual({ message: 'Hello' })
  expect(onRetry.mock.calls.map(([event]) => event.retry)).toEqual([1, 2])
})

it('surfaces streamed terminal errors with their status for the existing error UI', async () => {
  sessionStorage.setItem('token', 'test-token')
  vi.spyOn(http, 'post').mockResolvedValue({ data: JSON.stringify({ type: 'error', status: 503, message: 'Gemini is temporarily unavailable. Please try again.' }) + '\n' })
  await expect(sendAssistantMessage('family', [], undefined, {}, vi.fn())).rejects.toMatchObject({ response: { status: 503 } })
})
