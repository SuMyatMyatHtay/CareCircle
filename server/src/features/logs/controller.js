// Owner: SeungHak (F)
// Handlers for /api/families/:familyId/logs. See docs/API-CONTRACT.md (section F).
//
// requireAuth + requireFamilyMember run before every handler, so these are always set:
//   req.user.userId, req.family, req.memberRole

import mongoose from 'mongoose'
import LogEntry from './CareLog.model.js'
import { EVENTS, LOG_TYPES } from '../../constants.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const USER_FIELDS = 'name telegramUsername'
const RECIPIENT_FIELDS = 'name nickname careType'

// ---------- Helpers ----------

function httpError(status, message, errors) {
    return Object.assign(new Error(message), { status, errors })
}

// Send known errors as { error, errors? }; pass anything else to the global handler
function handleError(error, res, next) {
    if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({
            error: 'Validation failed',
            errors: Object.values(error.errors).map((e) => e.message)
        })
    }

    if (error.status) {
        const body = { error: error.message }
        if (error.errors) body.errors = error.errors
        return res.status(error.status).json(body)
    }

    return next(error)
}

function parseDate(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

// author is always populated; recipient only once package C registers its model
function populateRefs(query) {
    query.populate('author', USER_FIELDS)
    if (mongoose.models.CareRecipient) query.populate('recipient', RECIPIENT_FIELDS)
    return query
}

// Placeholder until utils/notify.js (Telegram) and Socket.IO exist.
// Every log write already calls this, so wiring them up is a one-line change.
function announce(_eventType, _log) {}

// Copy only the fields a client may set. family and author always come from the
// request, never from the body.
//   partial: false (create) requires recipient, type and content.
//   partial: true  (update) accepts only content, type, consultation, medicationChanges;
//                  recipient, task, author and inputMethod can't change after creation.
function parseLogInput(body, { partial }) {
    const input = body && typeof body === 'object' ? body : {}
    const data = {}
    const errors = []
    const has = (key) => input[key] !== undefined

    if (!partial) {
        if (!mongoose.isValidObjectId(input.recipient)) {
            errors.push('Recipient is required')
        } else {
            data.recipient = input.recipient
        }

        if (has('task') && input.task !== null && input.task !== '') {
            if (mongoose.isValidObjectId(input.task)) data.task = input.task
            else errors.push('Task is invalid')
        }

        if (has('inputMethod')) data.inputMethod = input.inputMethod
        if (typeof input.originalLang === 'string' && input.originalLang.trim()) {
            data.originalLang = input.originalLang
        }
    }

    if (has('type') || !partial) {
        if (!LOG_TYPES.includes(input.type)) {
            errors.push(`Type must be one of: ${LOG_TYPES.join(', ')}`)
        } else {
            data.type = input.type
        }
    }

    if (has('content') || !partial) {
        if (typeof input.content !== 'string' || !input.content.trim()) {
            errors.push('Content is required')
        } else {
            data.content = input.content
        }
    }

    if (has('consultation')) {
        if (input.consultation === null) {
            data.consultation = null
        } else if (typeof input.consultation === 'object' && !Array.isArray(input.consultation)) {
            data.consultation = input.consultation
        } else {
            errors.push('Consultation must be an object')
        }
    }

    if (has('medicationChanges')) {
        if (Array.isArray(input.medicationChanges)) data.medicationChanges = input.medicationChanges
        else errors.push('medicationChanges must be a list')
    }

    if (errors.length) throw httpError(400, 'Validation failed', errors)
    return data
}

// Consultation details only make sense on a consultation log, so drop them otherwise
function dropConsultationUnlessConsultation(data, type) {
    if (type !== 'consultation') data.consultation = null
    return data
}

// 404 for a malformed id or a log from another family, so ids can't be probed
async function findLogInFamily(familyId, logId) {
    if (!mongoose.isValidObjectId(logId)) throw httpError(404, 'Log not found')

    const log = await LogEntry.findOne({ _id: logId, family: familyId })
    if (!log) throw httpError(404, 'Log not found')
    return log
}

// Only the author or a family admin may edit or delete a log
function assertCanChange(log, req) {
    const isAuthor = log.author.toString() === req.user.userId
    if (!isAuthor && req.memberRole !== 'admin') {
        throw httpError(403, 'Only the author or a family admin can change this log')
    }
}

// The recipient and task must belong to this family. Each check runs only once
// its package has registered the model (C: CareRecipient, D: Task).
async function assertRefsInFamily(data, familyId) {
    const errors = []
    const { CareRecipient, Task } = mongoose.models

    if (CareRecipient && !(await CareRecipient.exists({ _id: data.recipient, family: familyId }))) {
        errors.push('Recipient not found in this family')
    }
    if (data.task && Task && !(await Task.exists({ _id: data.task, family: familyId }))) {
        errors.push('Task not found in this family')
    }

    if (errors.length) throw httpError(400, 'Validation failed', errors)
}

// ---------- Handlers ----------

// GET /api/families/:familyId/logs?recipient=<id>&before=<date>&limit=<n>
// Newest first. Use `before` with the oldest createdAt you have to load the next page.
export async function listLogs(req, res, next) {
    try {
        const { recipient, before, limit } = req.query
        const filter = { family: req.family._id }
        const errors = []

        if (recipient !== undefined) {
            if (mongoose.isValidObjectId(recipient)) filter.recipient = recipient
            else errors.push('Recipient is invalid')
        }

        if (before !== undefined) {
            const beforeDate = parseDate(before)
            if (!beforeDate) errors.push('before must be a valid date')
            else filter.createdAt = { $lt: beforeDate }
        }

        let pageSize = DEFAULT_LIMIT
        if (limit !== undefined) {
            pageSize = Number(limit)
            if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_LIMIT) {
                errors.push(`limit must be a whole number from 1 to ${MAX_LIMIT}`)
            }
        }

        if (errors.length) throw httpError(400, 'Validation failed', errors)

        const logs = await populateRefs(
            LogEntry.find(filter).sort({ createdAt: -1 }).limit(pageSize)
        )

        return res.json({ logs })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// POST /api/families/:familyId/logs
// Body: { recipient, type, content, task?, consultation?, medicationChanges?, inputMethod?, originalLang? }
export async function createLog(req, res, next) {
    try {
        const parsed = parseLogInput(req.body, { partial: false })
        const data = dropConsultationUnlessConsultation(parsed, parsed.type)
        await assertRefsInFamily(data, req.family._id)

        const log = await LogEntry.create({
            ...data,
            family: req.family._id,
            author: req.user.userId
        })

        const populated = await populateRefs(LogEntry.findById(log._id))
        announce(EVENTS.LOG_CREATED, populated)
        if (populated.medicationChanges.length) announce(EVENTS.MEDICATION_CHANGED, populated)

        return res.status(201).json({ log: populated })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// GET /api/families/:familyId/logs/:logId
// TODO: ?lang=zh will add translatedContent once LibreTranslate is wired up.
export async function getLog(req, res, next) {
    try {
        const log = await findLogInFamily(req.family._id, req.params.logId)
        return res.json({ log: await populateRefs(LogEntry.findById(log._id)) })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// PATCH /api/families/:familyId/logs/:logId   (author or admin)
// Body: any of { content, type, consultation, medicationChanges }
export async function updateLog(req, res, next) {
    try {
        const log = await findLogInFamily(req.family._id, req.params.logId)
        assertCanChange(log, req)

        const data = parseLogInput(req.body, { partial: true })
        if (!Object.keys(data).length) {
            throw httpError(400, 'Validation failed', [
                'Send at least one of: content, type, consultation, medicationChanges'
            ])
        }

        // Switching away from 'consultation' clears its details
        const nextType = data.type ?? log.type
        if (nextType !== 'consultation') data.consultation = null

        // Cached translations describe the old text, so drop them when it changes
        if (data.content !== undefined && data.content.trim() !== log.content) {
            log.translations = new Map()
        }

        log.set(data)
        await log.save()

        const populated = await populateRefs(LogEntry.findById(log._id))
        if (data.medicationChanges?.length) announce(EVENTS.MEDICATION_CHANGED, populated)

        return res.json({ log: populated })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// DELETE /api/families/:familyId/logs/:logId   (author or admin)
export async function deleteLog(req, res, next) {
    try {
        const log = await findLogInFamily(req.family._id, req.params.logId)
        assertCanChange(log, req)

        await log.deleteOne()
        return res.status(204).end()
    } catch (error) {
        return handleError(error, res, next)
    }
}
