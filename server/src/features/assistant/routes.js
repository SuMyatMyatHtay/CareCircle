import { Router } from 'express'
import mongoose from 'mongoose'
import { chat, confirm, cancel } from './service.js'

const router = Router()
// Small per-process quota protects accidental rapid clicks; Gemini also enforces project limits.
const windows = new Map()
function rateLimit(req, res, next) {
  const now = Date.now()
  for (const [key, value] of windows) if (value.reset <= now) windows.delete(key)
  const key = req.user.userId
  const value = windows.get(key) || { reset: now + 60000, count: 0 }
  if (++value.count > 10) return res.status(429).json({ message: 'Please wait a minute before sending more messages.' })
  windows.set(key, value)
  next()
}
function handler(run) {
  return async (req, res, next) => {
    const streaming = run === chat && req.get('accept') === 'application/x-ndjson'
    const controller = new AbortController()
    const disconnected = () => { if (!res.writableEnded) controller.abort() }
    res.on('close', disconnected)
    const emit = event => { if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`) }
    if (streaming) {
      res.set({ 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' })
      res.flushHeaders()
    }
    try {
      const result = await run({ body: req.body, proposalId: req.params.proposalId,
        familyId: req.family._id, familyName: req.family.name, userId: req.user.userId, memberRole: req.memberRole,
        signal: controller.signal, onRetry: streaming ? progress => emit({ type: 'retry', ...progress }) : undefined })
      if (streaming) { emit({ type: 'result', data: result }); return res.end() }
      return res.json(result)
    } catch (error) {
      if (streaming) {
        const status = error.status || (error instanceof mongoose.Error.ValidationError ? 400 : 500)
        emit({ type: 'error', status, message: error.status ? error.message : 'Unable to complete the assistant request. Please try again.', errors: error.errors })
        return res.end()
      }
      if (error.status) return res.status(error.status).json({ message: error.message, errors: error.errors })
      if (error instanceof mongoose.Error.ValidationError) return res.status(400).json({ message: 'Invalid task details. Please try again.' })
      return next(error)
    } finally { res.off('close', disconnected) }
  }
}
router.post('/chat', rateLimit, handler(chat))
router.post('/proposals/:proposalId/confirm', handler(confirm))
router.post('/proposals/:proposalId/cancel', handler(cancel))
export default router
