// Owner: Marcus (D)
// Calls to /api/families/:familyId/tasks. See docs/API-CONTRACT.md (section D).
import { http } from '../../../services/http.js'

function authHeaders() {
    const token = sessionStorage.getItem('token')

    if (!token) {
        throw new Error('Please log in first.')
    }

    return { Authorization: `Bearer ${token}` }
}

// Get the family's tasks, sorted by start time.
// filters (all optional): { status: 'open,claimed', recipient, claimedBy, from, to }
export async function getFamilyTasks(familyId, filters = {}) {
    const response = await http.get(
        `/families/${familyId}/tasks`,
        { headers: authHeaders(), params: filters }
    )

    return response.data.tasks
}

// Task errors come back as { error, errors? }, unlike family/auth's { message }
export function getTaskErrorMessage(error) {
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
