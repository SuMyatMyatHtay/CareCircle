import { randomInt, randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import User from './User.model.js'

const generic = 'If an account exists for this email, a reset code will be sent. Check your inbox and spam folder.'
const invalid = 'The code is invalid or expired. Request a new code if needed.'
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const digest = (email, code) => createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex')

export async function sendResetEmail(email, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.PASSWORD_RESET_FROM, to: [email],
      subject: 'Your CareCircle password reset code',
      text: `Your CareCircle password reset code is ${code}. It expires in 10 minutes. Do not share this code. If you did not request a password reset, you can ignore this email.` }),
  })
  if (!response.ok) {
    const details = await response.json().catch(() => ({}))
    // Log only the provider's error category; never its body or credentials.
    console.error('Reset email provider rejected request', { status: response.status, category: typeof details.name === 'string' ? details.name.slice(0, 80) : 'unknown' })
    throw new Error('Email delivery failed')
  }
}

// Supplement the durable per-account cooldown with an IP limit. Bounded storage
// prevents random addresses from growing the map indefinitely.
export function resetRateLimit() {
  const clients = new Map()
  return (req, res, next) => {
    const now = Date.now()
    for (const [key, value] of clients) if (value.until <= now) clients.delete(key)
    const key = req.ip
    const value = clients.get(key) || { count: 0, until: now + 15 * 60000 }
    if (value.count >= 30 || (!clients.has(key) && clients.size >= 10000)) {
      return res.status(429).json({ success: false, message: 'Too many password reset requests. Please try again in 15 minutes.' })
    }
    value.count++; clients.set(key, value); next()
  }
}

export function passwordResetHandlers({ deliver = sendResetEmail } = {}) {
  return {
    async requestCode(req, res) {
      const email = normalizeEmail(req.body?.email)
      if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' })
      if (!process.env.JWT_SECRET || !process.env.RESEND_API_KEY || !process.env.PASSWORD_RESET_FROM) {
        return res.status(503).json({ success: false, message: 'Password reset email is not configured yet. Please contact the CareCircle administrator.' })
      }
      try {
        const code = String(randomInt(0, 1000000)).padStart(6, '0')
        const hash = digest(email, code)
        const now = new Date()
        // Only one concurrent request may replace a code during the cooldown.
        const user = await User.findOneAndUpdate({ email, $or: [
          { 'passwordReset.sentAt': { $exists: false } },
          { 'passwordReset.sentAt': { $lte: new Date(+now - 60000) } },
        ] }, { $set: { passwordReset: { hash, sentAt: now, expiresAt: new Date(+now + 10 * 60000), attempts: 5 } } }, { new: true })
        if (user) {
          try { await deliver(email, code) }
          catch {
            // Keep the same public response for unknown accounts and provider
            // failures; neither response exposes whether the account exists.
            await User.updateOne({ _id: user._id, 'passwordReset.hash': hash }, { $unset: { 'passwordReset.hash': 1 } })
            console.error('Password reset email delivery failed')
          }
        }
        return res.json({ success: true, message: generic })
      } catch {
        return res.status(503).json({ success: false, message: 'Unable to request a reset code right now. Please try again.' })
      }
    },
    async verifyCode(req, res) {
      const email = normalizeEmail(req.body?.email)
      const { code } = req.body || {}
      if (!validEmail(email) || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email and six-digit code.' })
      }
      if (!process.env.JWT_SECRET) return res.status(503).json({ success: false, message: 'Password reset is unavailable right now.' })
      try {
        // Reserve one of five attempts atomically before checking the code.
        const user = await User.findOneAndUpdate({ email, 'passwordReset.hash': { $exists: true },
          'passwordReset.expiresAt': { $gt: new Date() }, 'passwordReset.attempts': { $gt: 0 },
        }, { $inc: { 'passwordReset.attempts': -1 } }, { new: true }).select('+passwordReset')
        const hash = digest(email, code)
        if (!user || !timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordReset.hash, 'hex'))) {
          return res.status(400).json({ success: false, message: invalid })
        }
        const resetToken = randomBytes(32).toString('hex')
        const result = await User.updateOne({ _id: user._id, 'passwordReset.hash': hash,
          'passwordReset.sentAt': user.passwordReset.sentAt,
          'passwordReset.expiresAt': { $gt: new Date() },
        }, { $set: { 'passwordReset.tokenHash': digest(email, resetToken), 'passwordReset.tokenExpiresAt': new Date(Date.now() + 5 * 60000) },
          $unset: { 'passwordReset.hash': 1, 'passwordReset.expiresAt': 1, 'passwordReset.attempts': 1 } })
        if (!result.modifiedCount) return res.status(400).json({ success: false, message: invalid })
        return res.json({ success: true, resetToken, message: 'Code verified. You can now choose a new password.' })
      } catch {
        return res.status(503).json({ success: false, message: 'Unable to reset your password right now. Please try again.' })
      }
    },
    async resetPassword(req, res) {
      const email = normalizeEmail(req.body?.email)
      const { resetToken, password, confirmPassword } = req.body || {}
      if (!validEmail(email) || typeof resetToken !== 'string' || !/^[a-f0-9]{64}$/.test(resetToken) ||
          typeof password !== 'string' || password.length < 8 || password.length > 128 || confirmPassword !== password) {
        return res.status(400).json({ success: false, message: 'Verify your code first and enter matching passwords of 8–128 characters.' })
      }
      if (!process.env.JWT_SECRET) return res.status(503).json({ success: false, message: 'Password reset is unavailable right now.' })
      try {
        const tokenHash = digest(email, resetToken)
        const scope = { email, 'passwordReset.tokenHash': tokenHash, 'passwordReset.tokenExpiresAt': { $gt: new Date() } }
        if (!await User.exists(scope)) return res.status(400).json({ success: false, message: 'Your reset session is invalid or expired. Please request a new code.' })
        const passwordHash = await bcrypt.hash(password, 12)
        const result = await User.updateOne(scope, { $set: { passwordHash }, $inc: { tokenVersion: 1 },
          $unset: { 'passwordReset.tokenHash': 1, 'passwordReset.tokenExpiresAt': 1 } })
        if (!result.modifiedCount) return res.status(400).json({ success: false, message: 'Your reset session is invalid or expired. Please request a new code.' })
        return res.json({ success: true, message: 'Password reset successfully. Log in with your new password.' })
      } catch {
        return res.status(503).json({ success: false, message: 'Unable to reset your password right now. Please try again.' })
      }
    },
  }
}
