// Owner: Chaithra (E)
// Connect / disconnect Google Calendar, and the page Google sends people back to.
import jwt from 'jsonwebtoken'
import GoogleCalendarLink from './GoogleCalendarLink.model.js'
import { isConfigured, consentUrl, exchangeCode, revoke, appOrigin } from './google.js'
import { syncUser, removeAllEvents } from './sync.js'

const STATE_PURPOSE = 'google-calendar'

// GET /api/me/google   -> { available, connected, email, lastSyncedAt, lastError }
export async function getStatus(req, res, next) {
    try {
        if (!isConfigured()) return res.json({ available: false, connected: false })
        const link = await GoogleCalendarLink.findOne({ user: req.user.userId })
        return res.json({
            available: true,
            connected: Boolean(link),
            email: link?.googleEmail || '',
            lastSyncedAt: link?.lastSyncedAt || null,
            lastError: link?.lastError || ''
        })
    } catch (error) {
        return next(error)
    }
}

// GET /api/me/google/connect   -> { url }  (the browser then goes to Google)
export function getConnectUrl(req, res) {
    if (!isConfigured()) {
        return res.status(503).json({ error: 'Google Calendar sync is not set up on this server' })
    }
    // "state" proves who started the sign-in, since Google's redirect has no login token
    const state = jwt.sign({ userId: req.user.userId, purpose: STATE_PURPOSE }, process.env.JWT_SECRET, { expiresIn: '10m' })
    return res.json({ url: consentUrl(state) })
}

// GET /api/google/callback?code=...&state=...   (public: Google sends the browser here)
export async function oauthCallback(req, res) {
    const back = (result) => res.redirect(`${appOrigin()}/my-tasks?calendar=${result}`)
    try {
        if (!isConfigured()) return back('error')
        if (req.query.error) return back('cancelled') // they clicked Cancel on Google's page

        const payload = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] })
        if (payload?.purpose !== STATE_PURPOSE || !payload.userId) return back('error')

        const { refreshToken, email } = await exchangeCode(String(req.query.code || ''))
        if (!refreshToken) return back('error')

        await GoogleCalendarLink.findOneAndUpdate(
            { user: payload.userId },
            { $set: { refreshToken, googleEmail: email, connectedAt: new Date(), lastError: '' } },
            { upsert: true, setDefaultsOnInsert: true }
        )

        // Put their current tasks in right away
        await syncUser(payload.userId).catch(() => {})
        return back('connected')
    } catch (error) {
        console.error('Google Calendar connect failed:', error.message)
        return back('error')
    }
}

// POST /api/me/google/sync   -> { connected, added, updated, removed }
export async function syncNowHandler(req, res) {
    try {
        const result = await syncUser(req.user.userId)
        return res.json(result)
    } catch (error) {
        return res.status(502).json({ error: 'Could not reach Google Calendar. Please try again.' })
    }
}

// DELETE /api/me/google?removeEvents=true   -> 204
export async function disconnect(req, res, next) {
    try {
        const link = await GoogleCalendarLink.findOne({ user: req.user.userId }).select('+refreshToken')
        if (link) {
            if (req.query.removeEvents === 'true') await removeAllEvents(link).catch(() => {})
            await revoke(link.refreshToken)
            await GoogleCalendarLink.deleteOne({ _id: link._id })
        }
        return res.status(204).end()
    } catch (error) {
        return next(error)
    }
}
