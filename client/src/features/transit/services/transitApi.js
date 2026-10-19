// Owner: Chaithra (E)
// Calls for Transit Mode and the OneMap clinic search.
import { http } from '../../../services/http.js'
import { authHeaders } from '../../my-tasks/services/myTasksApi.js'

const base = (familyId, taskId) => `/families/${familyId}/tasks/${taskId}`

// D's endpoint: the task itself (title, time, location, who claimed it)
export async function getTask(familyId, taskId) {
    const response = await http.get(base(familyId, taskId), { headers: authHeaders() })
    return response.data.task
}

// Returns null if the trip hasn't been started yet (404)
export async function getTransitSession(familyId, taskId) {
    try {
        const response = await http.get(`${base(familyId, taskId)}/transit`, { headers: authHeaders() })
        return response.data.transitSession
    } catch (error) {
        if (error.response?.status === 404) return null
        throw error
    }
}

// Preset step: { type: 'arrived' }. Custom step: { type: 'custom', label: 'Going for lunch' }
export async function postMilestone(familyId, taskId, milestone) {
    const response = await http.post(
        `${base(familyId, taskId)}/transit/milestones`, milestone, { headers: authHeaders() }
    )
    return response.data.transitSession
}

// "End transit": stops the trip without completing the task
export async function endTransit(familyId, taskId) {
    const response = await http.post(`${base(familyId, taskId)}/transit/end`, null, { headers: authHeaders() })
    return response.data.transitSession
}

// Live location: the companion's browser sends { lat, lng } while the trip is active
export async function updateLocation(familyId, taskId, position) {
    const response = await http.patch(`${base(familyId, taskId)}/transit/location`, position, { headers: authHeaders() })
    return response.data.lastLocation
}

// For the live banner on Family Home
export async function getActiveTransitSessions(familyId) {
    const response = await http.get(`/families/${familyId}/transit`, {
        headers: authHeaders(),
        params: { status: 'active' }
    })
    return response.data.transitSessions
}

// OneMap search through our backend. Each clinic: { name, address, postal, lat, lng }
// { clinics, otherPlaces }: medical places first; otherPlaces is for when nothing medical matched
export async function searchClinics(query) {
    const response = await http.get('/integrations/clinics', { headers: authHeaders(), params: { q: query } })
    return { clinics: response.data.clinics || [], otherPlaces: response.data.otherPlaces || [] }
}

// Undo an accidental "End transit": the same trip carries on
export async function resumeTransit(familyId, taskId) {
    const response = await http.post(`${base(familyId, taskId)}/transit/resume`, null, { headers: authHeaders() })
    return response.data.transitSession
}
