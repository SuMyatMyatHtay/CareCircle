// Owner: Marcus (D)
// Calls to /api/families/:familyId/search.
import { http } from '../../../services/http.js'

function authHeaders() {
    const token = sessionStorage.getItem('token')

    if (!token) {
        throw new Error('Please log in first.')
    }

    return { Authorization: `Bearer ${token}` }
}

// Search the family's tasks, care log notes, people and places.
// params: { q, type?, recipient?, when?, status?, sort?, limit? } (empty values are left out)
// options.signal: an AbortSignal, so an older search can be cancelled
// Returns { query, counts: { all, tasks, logs, people, places }, results: { tasks, logs, people, places } }
export async function searchFamily(familyId, params, { signal } = {}) {
    const query = Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    )

    const response = await http.get(
        `/families/${familyId}/search`,
        { headers: authHeaders(), params: query, signal }
    )

    return response.data
}

export function getSearchErrorMessage(error) {
    if (error.response?.status === 401) {
        return 'Your session has expired. Please log in again.'
    }

    return (
        error.response?.data?.error ||
        'Search is unavailable right now. Please try again.'
    )
}
