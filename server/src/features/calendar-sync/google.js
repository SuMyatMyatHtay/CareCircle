// Owner: Chaithra (E)
// Talking to Google: "Sign in with Google" (OAuth) and the Google Calendar API.
// Plain fetch calls, no extra packages. Needs three lines in server/.env:
//   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
//   GOOGLE_CLIENT_SECRET=...
//   GOOGLE_REDIRECT_URI=http://localhost:5173/api/google/callback
// Without them, Google Calendar sync is simply switched off (the button doesn't show).

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

// Only what's needed: add/change/remove events, and the person's email to show "Connected as …"
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events']

export function isConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI)
}

// Where to send the person back to after Google (the website, not the API)
export function appOrigin() {
    return new URL(process.env.GOOGLE_REDIRECT_URI).origin
}

export function consentUrl(state) {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline', // gives a refresh token, so syncing works later without them
        prompt: 'consent',      // always ask, so Google always sends the refresh token
        include_granted_scopes: 'true',
        state
    })
    return `${AUTH_URL}?${params.toString()}`
}

async function tokenRequest(body) {
    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            ...body
        }),
        signal: AbortSignal.timeout(10000)
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
        const error = new Error(data.error_description || data.error || `Google token error ${response.status}`)
        error.google = data.error
        throw error
    }
    return data
}

// After "Allow": swap the one-time code for tokens. Returns { refreshToken, email }
export async function exchangeCode(code) {
    const data = await tokenRequest({
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI
    })
    let email = ''
    try {
        // The id_token is a JWT from Google; its middle part holds the email
        email = JSON.parse(Buffer.from(data.id_token.split('.')[1], 'base64url').toString()).email || ''
    } catch { /* email is only for display */ }
    return { refreshToken: data.refresh_token, accessToken: data.access_token, expiresIn: data.expires_in, email }
}

// Short-lived access tokens, cached per refresh token until just before they expire
const accessCache = new Map()
export async function accessTokenFor(refreshToken) {
    const cached = accessCache.get(refreshToken)
    if (cached && cached.expiresAt > Date.now() + 60 * 1000) return cached.token
    const data = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' })
    accessCache.set(refreshToken, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 })
    return data.access_token
}

export async function revoke(refreshToken) {
    accessCache.delete(refreshToken)
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(8000)
    }).catch(() => {})
}

// One Calendar API call. Returns the JSON (or null for an empty reply).
// Throws an error with .status (e.g. 404 if the person deleted the event themselves).
export async function calendarRequest(accessToken, method, eventId, body) {
    const url = eventId ? `${EVENTS_URL}/${encodeURIComponent(eventId)}` : EVENTS_URL
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000)
    })
    if (response.status === 204) return null
    const data = await response.json().catch(() => null)
    if (!response.ok) {
        const error = new Error(data?.error?.message || `Google Calendar error ${response.status}`)
        error.status = response.status
        throw error
    }
    return data
}
