// Owner: Chaithra (E)
// Google Calendar auto-sync: connect once, then claimed tasks appear in Google Calendar
// by themselves (and update / disappear when the task changes).
import { http } from '../../../services/http.js'
import { authHeaders } from './myTasksApi.js'

// { available, connected, email, lastSyncedAt, lastError }
export async function getGoogleStatus() {
    const response = await http.get('/me/google', { headers: authHeaders() })
    return response.data
}

// Sends the browser to Google's "Allow CareCircle to…" page
export async function connectGoogle() {
    const response = await http.get('/me/google/connect', { headers: authHeaders() })
    window.location.href = response.data.url
}

// { connected, added, updated, removed }
export async function syncGoogleNow() {
    const response = await http.post('/me/google/sync', null, { headers: authHeaders() })
    return response.data
}

export async function disconnectGoogle({ removeEvents = false } = {}) {
    await http.delete('/me/google', { headers: authHeaders(), params: { removeEvents } })
}
