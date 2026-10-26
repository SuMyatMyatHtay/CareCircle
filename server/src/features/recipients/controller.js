// Owner: Jhen (C)
// Handlers for /api/families/:familyId/recipients. See docs/API-CONTRACT.md (section C).
//
// All database access goes through the statics in CareRecipient.model.js.
//
// requireAuth + requireFamilyMember run before every handler, so these are always set:
//   req.user.userId, req.family, req.memberRole

import mongoose from 'mongoose'
import { validProfilePicture } from '../../utils/profilePicture.js'
import CareRecipient from './CareRecipient.model.js'
import { CARE_TYPES, EVENTS } from '../../constants.js'
import { notify } from '../../utils/notify.js'
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

    // The only unique index here is { family, linkedUser }
    if (error.code === 11000) {
        return res.status(409).json({
            error: 'This user is already linked to another care recipient in this family'
        })
    }

    if (error.status) {
        const body = { error: error.message }
        if (error.errors) body.errors = error.errors
        return res.status(error.status).json(body)
    }

    return next(error)
}

// Placeholder until F adds utils/notify.js and D adds Socket.IO.
// Every medication change already calls this, so wiring them up is a one-line change.
// replaced
async function announce(eventType, recipient) {
    await notify(recipient.family, eventType, recipient)
}

async function findRecipientInFamily(familyId, recipientId) {
    // A malformed id is treated as not found, same as requireFamilyMember
    if (!mongoose.isValidObjectId(recipientId)) {
        throw httpError(404, 'Care recipient not found')
    }

    const recipient = await CareRecipient.getRecipientInFamily(familyId, recipientId)
    if (!recipient) throw httpError(404, 'Care recipient not found')
    return recipient
}

function parseDate(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

// Copy only the listed text fields, so extra keys (e.g. updatedBy) are dropped
function pickText(source, keys, label, errors) {
    const picked = {}
    for (const key of keys) {
        if (source[key] === undefined || source[key] === null) continue
        if (typeof source[key] !== 'string') errors.push(`${label} ${key} must be text`)
        else picked[key] = source[key]
    }
    return picked
}

// null clears the list. Returns undefined if the value isn't a list of objects.
function parseObjectList(value, label, pick, errors) {
    if (value === null) return []
    if (!Array.isArray(value) || !value.every(isPlainObject)) {
        errors.push(`${label} must be a list of objects`)
        return undefined
    }
    return value.map(pick)
}

// null clears the list; blank entries are dropped
function parseTextList(value, label, errors) {
    if (value === null) return []
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
        errors.push(`${label} must be a list of text`)
        return undefined
    }
    return value.filter((item) => item.trim())
}

function parseLocation(value, errors) {
    if (value === null || value === '') return null

    if (!isPlainObject(value)) {
        errors.push('Preferred clinic must be an object')
        return undefined
    }

    const location = pickText(value, ['name', 'address', 'postal'], 'Preferred clinic', errors)
    for (const key of ['lat', 'lng']) {
        if (value[key] === undefined || value[key] === null) continue
        if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
            errors.push(`Preferred clinic ${key} must be a number`)
        } else {
            location[key] = value[key]
        }
    }
    return location
}

// Pick and type-check the editable fields from a request body.
// partial = true for PATCH (only the fields sent), false for POST.
// family, isActive and timestamps are never picked. Length/enum limits
// inside sub-documents are left to the schema validators.
function parseRecipientInput(body, { partial }) {
    const input = isPlainObject(body) ? body : {}
    const data = {}
    const errors = []
    const has = (key) => input[key] !== undefined

    if (has('profilePicture')) {
        if (!validProfilePicture(input.profilePicture)) errors.push('Choose a valid profile picture')
        else data.profilePicture = input.profilePicture
    }

    if (has('name') || !partial) {
        if (typeof input.name !== 'string' || !input.name.trim()) errors.push('Name is required')
        else data.name = input.name
    }

    if (has('careType') || !partial) {
        if (!CARE_TYPES.includes(input.careType)) {
            errors.push(`Care type must be one of: ${CARE_TYPES.join(', ')}`)
        } else {
            data.careType = input.careType
        }
    }

    for (const [key, label] of [['nickname', 'Nickname'], ['careNotes', 'Care notes']]) {
        if (!has(key)) continue
        if (input[key] === null) data[key] = ''
        else if (typeof input[key] !== 'string') errors.push(`${label} must be text`)
        else data[key] = input[key]
    }

    if (has('dateOfBirth')) {
        if (input.dateOfBirth === null || input.dateOfBirth === '') {
            data.dateOfBirth = null
        } else {
            const dateOfBirth = parseDate(input.dateOfBirth)
            if (!dateOfBirth) errors.push('Date of birth must be a valid date')
            else data.dateOfBirth = dateOfBirth
        }
    }

    if (has('mobility')) {
        if (input.mobility === null) data.mobility = null
        else if (!isPlainObject(input.mobility)) errors.push('Mobility must be an object')
        else data.mobility = pickText(input.mobility, ['level', 'notes'], 'Mobility', errors)
    }

    if (has('allergies')) {
        const allergies = parseObjectList(input.allergies, 'Allergies',
            (item) => pickText(item, ['name', 'severity'], 'Allergy', errors), errors)
        if (allergies !== undefined) data.allergies = allergies
    }

    for (const [key, label] of [['conditions', 'Conditions'], ['dietaryRestrictions', 'Dietary restrictions']]) {
        if (!has(key)) continue
        const list = parseTextList(input[key], label, errors)
        if (list !== undefined) data[key] = list
    }

    if (has('medications')) {
        const medications = parseObjectList(input.medications, 'Medications', (item) => {
            const medication = pickText(item, ['name', 'dosage', 'frequency', 'notes'], 'Medication', errors)
            if (item.startDate === null || item.startDate === '') {
                medication.startDate = null
            } else if (item.startDate !== undefined) {
                const startDate = parseDate(item.startDate)
                if (!startDate) errors.push('Medication startDate must be a valid date')
                else medication.startDate = startDate
            }
            return medication
        }, errors)
        if (medications !== undefined) data.medications = medications
    }

    if (has('emergencyContacts')) {
        const contacts = parseObjectList(input.emergencyContacts, 'Emergency contacts',
            (item) => pickText(item, ['name', 'relationship', 'phone'], 'Emergency contact', errors), errors)
        if (contacts !== undefined) data.emergencyContacts = contacts
    }

    if (has('preferredClinic')) {
        const clinic = parseLocation(input.preferredClinic, errors)
        if (clinic !== undefined) data.preferredClinic = clinic
    }

    if (has('linkedUser')) {
        if (input.linkedUser === null || input.linkedUser === '') {
            data.linkedUser = null
        } else if (!mongoose.isValidObjectId(input.linkedUser)) {
            errors.push('Linked user must be a member of this family')
        } else {
            data.linkedUser = input.linkedUser
        }
    }

    if (errors.length) throw httpError(400, 'Validation failed', errors)
    return data
}

function assertLinkedUserInFamily(linkedUser, family) {
    if (!linkedUser) return
    const isMember = family.members.some((m) => m.userId.toString() === linkedUser.toString())
    if (!isMember) {
        throw httpError(400, 'Validation failed', ['Linked user must be a member of this family'])
    }
}

// linkedUser means "this recipient is this person", so only that person can set it.
// Anyone can unlink, so a mistake can be fixed. Re-sending the current link is fine,
// because the edit form sends every field back.
function assertLinkAllowed({ linkedUser, careType, storedLinkedUser = null, userId }) {
    if (!linkedUser) return

    const isChange = linkedUser.toString() !== storedLinkedUser?.toString()
    if (isChange && linkedUser.toString() !== userId) {
        throw httpError(403, 'You can only link your own account')
    }
    if (careType === 'infant') {
        throw httpError(400, 'Validation failed', ['An infant profile cannot be linked to an account'])
    }
}

// Compared after trimming, the same way the schema stores them
function medicationKey(medication) {
    const text = (value) => (value ?? '').trim()
    return JSON.stringify([
        text(medication.name),
        text(medication.dosage),
        text(medication.frequency),
        medication.startDate ? new Date(medication.startDate).getTime() : null,
        text(medication.notes)
    ])
}

// Entries identical to a stored one keep their updatedBy/updatedAt;
// new or edited entries are stamped with the current user and time.
function stampMedications(medications, stored, userId) {
    const storedByKey = new Map(stored.map((m) => [medicationKey(m), m]))
    const now = new Date()

    const stamped = medications.map((medication) => {
        const match = storedByKey.get(medicationKey(medication))
        return match
            ? { ...medication, updatedBy: match.updatedBy, updatedAt: match.updatedAt }
            : { ...medication, updatedBy: userId, updatedAt: now }
    })

    // Same entries in any order counts as unchanged; a removed entry counts as a change
    const keys = (list) => list.map(medicationKey).sort().join('\n')
    return { medications: stamped, changed: keys(medications) !== keys(stored) }
}

// ---------- Handlers ----------

// GET /api/families/:familyId/recipients
// Query (optional): includeArchived=true
export async function listRecipients(req, res, next) {
    try {
        const includeArchived = req.query.includeArchived === 'true'
        const recipients = await CareRecipient.getRecipientsByFamily(req.family._id, { includeArchived })
        return res.json({ recipients })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// GET /api/families/:familyId/recipients/:recipientId
export async function getRecipient(req, res, next) {
    try {
        const recipient = await findRecipientInFamily(req.family._id, req.params.recipientId)
        return res.json({ recipient: await CareRecipient.getPopulatedRecipientById(recipient._id) })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// POST /api/families/:familyId/recipients
// New recipients are always active; family and isActive in the body are ignored.
export async function createRecipient(req, res, next) {
    try {
        const data = parseRecipientInput(req.body, { partial: false })
        assertLinkedUserInFamily(data.linkedUser, req.family)
        assertLinkAllowed({ linkedUser: data.linkedUser, careType: data.careType, userId: req.user.userId })

        if (data.medications) {
            data.medications = stampMedications(data.medications, [], req.user.userId).medications
        }

        const recipient = await CareRecipient.createRecipient({
            ...data,
            family: req.family._id,
            isActive: true
        })

        const populated = await CareRecipient.getPopulatedRecipientById(recipient._id)
        return res.status(201).json({ recipient: populated })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// PATCH /api/families/:familyId/recipients/:recipientId
export async function updateRecipient(req, res, next) {
    try {
        const recipient = await findRecipientInFamily(req.family._id, req.params.recipientId)

        // Only editable fields are picked, so family and isActive are ignored
        const changes = parseRecipientInput(req.body, { partial: true })
        if (!Object.keys(changes).length) {
            throw httpError(400, 'Validation failed', ['Nothing to update'])
        }

        assertLinkedUserInFamily(changes.linkedUser, req.family)
        // Check the result of the update, so changing an already-linked recipient
        // to infant is caught too
        assertLinkAllowed({
            linkedUser: changes.linkedUser !== undefined ? changes.linkedUser : recipient.linkedUser,
            careType: changes.careType ?? recipient.careType,
            storedLinkedUser: recipient.linkedUser,
            userId: req.user.userId
        })

        let medicationsChanged = false
        if (changes.medications) {
            const result = stampMedications(changes.medications, recipient.medications, req.user.userId)
            changes.medications = result.medications
            medicationsChanged = result.changed
        }

        const updated = await CareRecipient.updateRecipient(req.family._id, recipient._id, changes)
        if (!updated) throw httpError(404, 'Care recipient not found')

        const populated = await CareRecipient.getPopulatedRecipientById(updated._id)
        if (medicationsChanged) await announce(EVENTS.MEDICATION_CHANGED, populated)
        return res.json({ recipient: populated })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// POST /api/families/:familyId/recipients/:recipientId/archive   (admin)
// Recipients are archived, never deleted, so their tasks and logs stay readable.
export async function archiveRecipient(req, res, next) {
    try {
        const recipient = await findRecipientInFamily(req.family._id, req.params.recipientId)

        const archived = await CareRecipient.archiveRecipient(req.family._id, recipient._id)
        if (!archived) throw httpError(404, 'Care recipient not found')

        return res.json({ recipient: await CareRecipient.getPopulatedRecipientById(archived._id) })
    } catch (error) {
        return handleError(error, res, next)
    }
}
