import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../services/http.js', () => ({
    http: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
}))

import { http } from '../../../services/http.js'
import {
    getRecipients, getRecipient, createRecipient, updateRecipient, archiveRecipient,
    getRecipientErrorMessage
} from '../services/recipientsApi.js'

const AUTH = { headers: { Authorization: 'Bearer abc123' } }

beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    sessionStorage.setItem('token', 'abc123')
})

describe('TestSuite: recipientsApi requests', () => {
    it('Test1: reads call the right URL with the auth header and unwrap the data', async () => {
        http.get.mockResolvedValueOnce({ data: { recipients: [{ _id: 'r1' }] } })
        expect(await getRecipients('f1', { includeArchived: true })).toEqual([{ _id: 'r1' }])
        expect(http.get).toHaveBeenCalledWith('/families/f1/recipients', { ...AUTH, params: { includeArchived: true } })

        http.get.mockResolvedValueOnce({ data: { recipient: { _id: 'r1' } } })
        expect(await getRecipient('f1', 'r1')).toEqual({ _id: 'r1' })
        expect(http.get).toHaveBeenLastCalledWith('/families/f1/recipients/r1', AUTH)
    })

    it('Test2: create, update and archive use the right method, URL and body', async () => {
        http.post.mockResolvedValue({ data: { recipient: { _id: 'r1' } } })
        http.patch.mockResolvedValue({ data: { recipient: { _id: 'r1' } } })

        await createRecipient('f1', { name: 'Alice' })
        expect(http.post).toHaveBeenLastCalledWith('/families/f1/recipients', { name: 'Alice' }, AUTH)

        await updateRecipient('f1', 'r1', { nickname: 'Nana' })
        expect(http.patch).toHaveBeenCalledWith('/families/f1/recipients/r1', { nickname: 'Nana' }, AUTH)

        await archiveRecipient('f1', 'r1')
        expect(http.post).toHaveBeenLastCalledWith('/families/f1/recipients/r1/archive', null, AUTH)
    })

    it('Test3: without a token every call fails before reaching the network', async () => {
        sessionStorage.removeItem('token')

        await expect(getRecipients('f1')).rejects.toThrow('Please log in first.')
        await expect(createRecipient('f1', {})).rejects.toThrow('Please log in first.')
        await expect(archiveRecipient('f1', 'r1')).rejects.toThrow('Please log in first.')
        expect(http.get).not.toHaveBeenCalled()
        expect(http.post).not.toHaveBeenCalled()
    })
})

describe('TestSuite: getRecipientErrorMessage', () => {
    it('Test1: picks the most useful message available', () => {
        expect(getRecipientErrorMessage({ response: { status: 401 } })).toBe('Your session has expired. Please log in again.')
        expect(getRecipientErrorMessage({ response: { data: { errors: ['A.', 'B.'], error: 'x' } } })).toBe('A. B.')
        expect(getRecipientErrorMessage({ response: { data: { error: 'Only admins can do that.' } } })).toBe('Only admins can do that.')
        expect(getRecipientErrorMessage(new Error('Network Error'))).toBe('Network Error')
        expect(getRecipientErrorMessage({})).toBe('Something went wrong. Please try again.')
    })
})