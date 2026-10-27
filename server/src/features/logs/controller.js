// Owner: SeungHak (F)

import mongoose from 'mongoose'
import LogEntry from './CareLog.model.js'
import User from '../auth/User.model.js'
import { EVENTS, LOG_TYPES } from '../../constants.js'
import { translateText, isSupportedLanguage, SUPPORTED_LANGUAGES } from '../integrations/azureTranslate.js'
import { notify } from '../../utils/notify.js'
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const USER_FIELDS = 'name telegramUsername profilePicture'
const RECIPIENT_FIELDS = 'name nickname careType profilePicture'

function httpError(status, message, errors) {
    return Object.assign(new Error(message), { status, errors })
}

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

function populateRefs(query) {
    query.populate('author', USER_FIELDS)
    if (mongoose.models.CareRecipient) query.populate('recipient', RECIPIENT_FIELDS)
    return query
}

async function announce(eventType, log, options) {
    await notify(log.family, eventType, log, options)
}

// Compares medication lists, so editing only the text of a note isn't "medication was updated"
function medicationKey(list = []) {
    return JSON.stringify(list.map((m) => [m.name, m.change, m.details || '']))
}

// Edits and deletes name the person who did them, who may not be the author (an admin)
async function announceChange(eventType, log, req) {
    const changedBy = await User.findById(req.user.userId).select('name').lean()
    await announce(eventType, { ...log.toObject(), changedBy })
}

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

function dropConsultationUnlessConsultation(data, type) {
    if (type !== 'consultation') data.consultation = null
    return data
}

async function findLogInFamily(familyId, logId) {
    if (!mongoose.isValidObjectId(logId)) throw httpError(404, 'Log not found')

    const log = await LogEntry.findOne({ _id: logId, family: familyId })
    if (!log) throw httpError(404, 'Log not found')
    return log
}

function assertCanChange(log, req) {
    const isAuthor = log.author.toString() === req.user.userId
    if (!isAuthor && req.memberRole !== 'admin') {
        throw httpError(403, 'Only the author or a family admin can change this log')
    }
}

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

export async function listLogs(req, res, next) {
    try {
        const { recipient, task, before, limit, appointmentFrom, appointmentTo } = req.query
        const filter = { family: req.family._id }
        const errors = []

        if (recipient !== undefined) {
            if (mongoose.isValidObjectId(recipient)) filter.recipient = recipient
            else errors.push('Recipient is invalid')
        }

        if (task !== undefined) {
            if (mongoose.isValidObjectId(task)) filter.task = task
            else errors.push('Task is invalid')
        }

        // The Calendar: consultation notes whose next appointment falls in a date range
        if (appointmentFrom !== undefined || appointmentTo !== undefined) {
            const range = {}
            if (appointmentFrom !== undefined) {
                const fromDate = parseDate(appointmentFrom)
                if (!fromDate) errors.push('appointmentFrom must be a valid date')
                else range.$gte = fromDate
            }
            if (appointmentTo !== undefined) {
                const toDate = parseDate(appointmentTo)
                if (!toDate) errors.push('appointmentTo must be a valid date')
                else range.$lte = toDate
            }
            filter['consultation.nextAppointment'] = range
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
        // notify: false ("Notify the family Telegram group" unticked) still shows in Recent updates
        const options = { send: req.body?.notify !== false }
        // One message per note: a medication change says so, anything else is a new care note
        const event = populated.medicationChanges.length ? EVENTS.MEDICATION_CHANGED : EVENTS.LOG_CREATED
        await announce(event, populated, options)

        return res.status(201).json({ log: populated })
    } catch (error) {
        return handleError(error, res, next)
    }
}

export async function getLog(req, res, next) {
    try {
        const log = await findLogInFamily(req.family._id, req.params.logId)
        return res.json({ log: await populateRefs(LogEntry.findById(log._id)) })
    } catch (error) {
        return handleError(error, res, next)
    }
}

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

        const nextType = data.type ?? log.type
        if (nextType !== 'consultation') data.consultation = null

        if (data.content !== undefined && data.content.trim() !== log.content) {
            log.translations = new Map()
        }

        const medicationsBefore = medicationKey(log.medicationChanges)
        log.set(data)
        await log.save()

        const populated = await populateRefs(LogEntry.findById(log._id))
        // One message per edit: "medication was updated" only when the list really changed
        const medicationsChanged = populated.medicationChanges.length > 0 &&
            medicationKey(populated.medicationChanges) !== medicationsBefore
        if (medicationsChanged) await announce(EVENTS.MEDICATION_CHANGED, populated)
        else await announceChange(EVENTS.LOG_UPDATED, populated, req)

        return res.json({ log: populated })
    } catch (error) {
        return handleError(error, res, next)
    }
}

export async function deleteLog(req, res, next) {
    try {
        const log = await findLogInFamily(req.family._id, req.params.logId)
        assertCanChange(log, req)

        // Load the recipient's name now: it can't be looked up once the note is gone
        const populated = await populateRefs(LogEntry.findById(log._id))
        await log.deleteOne()
        await announceChange(EVENTS.LOG_DELETED, populated, req)
        return res.status(204).end()
    } catch (error) {
        return handleError(error, res, next)
    }
}

// using the translation api
export async function translateLog(req, res, next) {
    try {
        const log = await findLogInFamily(req.family._id, req.params.logId)

        // Only accept languages we know about
        const lang = req.body?.lang
        if (typeof lang !== 'string' || !isSupportedLanguage(lang)) {
            throw httpError(400, 'Validation failed', [
                `lang must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`
            ])
        }
        if (lang === log.originalLang) {
            throw httpError(400, 'Validation failed', ['This note is already in that language'])
        }

        // Cache hit: each text is only translated once per language
        const cached = log.translations?.get(lang)
        if (cached) return res.json({ lang, translation: cached, cached: true })

        let translation
        try {
            translation = await translateText(log.content, lang, log.originalLang)
        } catch (error) {
            console.error('Translation failed:', error.message)
            throw httpError(502, 'Translation service is unavailable. Please try again later.')
        }
        
        await LogEntry.updateOne(
            { _id: log._id, content: log.content },
            { $set: { [`translations.${lang}`]: translation } },
            { timestamps: false }
        )

        return res.json({ lang, translation, cached: false })
    } catch (error) {
        return handleError(error, res, next)
    }
}