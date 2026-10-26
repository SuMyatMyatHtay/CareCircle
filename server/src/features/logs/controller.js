// Owner: SeungHak (F)

import mongoose from 'mongoose'
import LogEntry from './CareLog.model.js'
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

// replaced
async function announce(eventType, log) {
    await notify(log.family, eventType, log)
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
        if (req.body?.notify !== false) {
            await announce(EVENTS.LOG_CREATED, populated)
            if (populated.medicationChanges.length) await announce(EVENTS.MEDICATION_CHANGED, populated)
        }

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

        log.set(data)
        await log.save()

        const populated = await populateRefs(LogEntry.findById(log._id))
        if (data.medicationChanges?.length) announce(EVENTS.MEDICATION_CHANGED, populated)

        return res.json({ log: populated })
    } catch (error) {
        return handleError(error, res, next)
    }
}

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
        
        console.log(lang, cached)

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