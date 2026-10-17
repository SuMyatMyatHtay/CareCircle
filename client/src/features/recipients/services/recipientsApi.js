// Owner: Jhen (C)
// Calls to /api/families/:familyId/recipients. See docs/API-CONTRACT.md (section C).
import { http } from '../../../services/http.js'

function authHeaders() {
    const token = sessionStorage.getItem('token')

    if (!token) {
        throw new Error('Please log in first.')
    }

    return { Authorization: `Bearer ${token}` }
}

function recipientsUrl(familyId, recipientId = '') {
    return `/families/${familyId}/recipients${recipientId ? `/${recipientId}` : ''}`
}

// Get the family's care recipients, sorted by name.
// filters (optional): { includeArchived: true }
export async function getRecipients(familyId, filters = {}) {
    const response = await http.get(recipientsUrl(familyId), {
        headers: authHeaders(),
        params: filters
    })

    return response.data.recipients
}

export async function getRecipient(familyId, recipientId) {
    const response = await http.get(recipientsUrl(familyId, recipientId), { headers: authHeaders() })
    return response.data.recipient
}

export async function createRecipient(familyId, recipient) {
    const response = await http.post(recipientsUrl(familyId), recipient, { headers: authHeaders() })
    return response.data.recipient
}

export async function updateRecipient(familyId, recipientId, changes) {
    const response = await http.patch(recipientsUrl(familyId, recipientId), changes, { headers: authHeaders() })
    return response.data.recipient
}

// Admin only. Recipients are archived, never deleted.
export async function archiveRecipient(familyId, recipientId) {
    const response = await http.post(`${recipientsUrl(familyId, recipientId)}/archive`, null, { headers: authHeaders() })
    return response.data.recipient
}

// Recipient errors come back as { error, errors? }, like tasks
export function getRecipientErrorMessage(error) {
    if (error.response?.status === 401) {
        return 'Your session has expired. Please log in again.'
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
