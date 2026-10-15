// Owner: SeungHak (F)
import { http } from '../../../services/http.js'

function authHeaders() {
    const token = sessionStorage.getItem('token')

    if (!token) {
        throw new Error('Please log in first.')
    }

    return { Authorization: `Bearer ${token}` }
}

function logsUrl(familyId, logId = '') {
    return `/families/${familyId}/logs${logId ? `/${logId}` : ''}`
}

export async function getLogs(familyId, filters = {}) {
    const response = await http.get(logsUrl(familyId), {
        headers: authHeaders(),
        params: filters
    })

    return response.data.logs
}

export async function getLog(familyId, logId) {
    const response = await http.get(logsUrl(familyId, logId), { headers: authHeaders() })
    return response.data.log
}

export const TRANSLATION_NOT_CONNECTED = "Translation isn't connected yet."

export async function translateLog(familyId, logId, lang) {
    const response = await http.get(logsUrl(familyId, logId), {
        headers: authHeaders(),
        params: { lang }
    })

    const text = response.data.log?.translatedContent
    if (!text) throw new Error(TRANSLATION_NOT_CONNECTED)
    return text
}

export async function createLog(familyId, log) {
    const response = await http.post(logsUrl(familyId), log, { headers: authHeaders() })
    return response.data.log
}

export async function updateLog(familyId, logId, changes) {
    const response = await http.patch(logsUrl(familyId, logId), changes, { headers: authHeaders() })
    return response.data.log
}

export async function deleteLog(familyId, logId) {
    await http.delete(logsUrl(familyId, logId), { headers: authHeaders() })
}

export function getLogErrorMessage(error) {
    if (error.response?.status === 401) {
        return 'Your session has expired. Please log in again.'
    }

    if (error.response?.status === 403) {
        return 'Only the person who wrote this note or a family admin can change it.'
    }

    if (error.response?.status === 404) {
        return 'This note no longer exists. It may have been deleted.'
    }

    if (!error.response && error.message !== 'Please log in first.') {
        return 'Unable to reach the server. Please check your connection.'
    }

    const data = error.response?.data

    if (data?.errors?.length) {
        return data.errors.join(' ')
    }

    return (
        data?.error ||
        error.message ||
        'Something went wrong. Please try again.'
    )
}
