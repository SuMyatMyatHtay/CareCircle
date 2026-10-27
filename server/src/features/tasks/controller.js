// Owner: Marcus (D)
// Handlers for /api/families/:familyId/tasks. See docs/API-CONTRACT.md (section D).
//
// All database access goes through the statics in TaskModel.js.
//
// requireAuth + requireFamilyMember run before every handler, so these are always set:
//   req.user.userId, req.family, req.memberRole

import mongoose from 'mongoose'
import Task, { LOCKED_STATUSES, UNDELETABLE_STATUSES } from './TaskModel.js'
import { TASK_CATEGORIES, TASK_STATUS, TASK_STATUSES, EVENTS } from '../../constants.js'
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

    if (error.status) {
        const body = { error: error.message }
        if (error.errors) body.errors = error.errors
        return res.status(error.status).json(body)
    }

    return next(error)
}

// Placeholder until F adds utils/notify.js and D adds Socket.IO.
// Every task write already calls this, so wiring them up is a one-line change.
// replaced 
async function announce(eventType, task) {
    const familyId = task?.family?._id ?? task?.family
    await notify(familyId, eventType, task)
}

function isCreatorOrAdmin(task, userId, memberRole) {
    return memberRole === 'admin' || task.createdBy.toString() === userId
}

function isClaimer(task, userId) {
    return task.claimedBy?.toString() === userId
}

async function findTaskInFamily(familyId, taskId) {
    // A malformed id is treated as not found, same as requireFamilyMember
    if (!mongoose.isValidObjectId(taskId)) {
        throw httpError(404, 'Task not found')
    }

    const task = await Task.getTaskInFamily(familyId, taskId)
    if (!task) throw httpError(404, 'Task not found')
    return task
}

function parseDate(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function parseLocation(value, errors) {
    if (value === null || value === '') return null

    if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push('Location must be an object')
        return undefined
    }

    const location = {}
    for (const key of ['name', 'address', 'postal']) {
        if (value[key] === undefined || value[key] === null) continue
        if (typeof value[key] !== 'string') {
            errors.push(`Location ${key} must be text`)
        } else {
            location[key] = value[key]
        }
    }
    for (const key of ['lat', 'lng']) {
        if (value[key] === undefined || value[key] === null) continue
        if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
            errors.push(`Location ${key} must be a number`)
        } else {
            location[key] = value[key]
        }
    }
    return location
}

// Pick and type-check the editable fields from a request body.
// partial = true for PATCH (only the fields sent), false for POST.
// Length/range limits are left to the schema validators.
export function parseTaskInput(body, { partial }) {
    const input = body && typeof body === 'object' ? body : {}
    const data = {}
    const errors = []
    const has = (key) => input[key] !== undefined

    if (has('title') || !partial) {
        if (typeof input.title !== 'string' || !input.title.trim()) {
            errors.push('Title is required')
        } else {
            data.title = input.title
        }
    }

    if (has('description')) {
        if (input.description === null) data.description = ''
        else if (typeof input.description !== 'string') errors.push('Description must be text')
        else data.description = input.description
    }

    if (has('category')) {
        if (!TASK_CATEGORIES.includes(input.category)) {
            errors.push(`Category must be one of: ${TASK_CATEGORIES.join(', ')}`)
        } else {
            data.category = input.category
        }
    }

    if (has('startAt') || !partial) {
        const startAt = parseDate(input.startAt)
        if (!startAt) errors.push('A valid start time is required')
        else data.startAt = startAt
    }

    if (has('endAt')) {
        if (input.endAt === null || input.endAt === '') {
            data.endAt = null
        } else {
            const endAt = parseDate(input.endAt)
            if (!endAt) errors.push('End time must be a valid date')
            else data.endAt = endAt
        }
    }

    if (has('recipient')) {
        if (input.recipient === null || input.recipient === '') {
            data.recipient = null
        } else if (!mongoose.isValidObjectId(input.recipient)) {
            errors.push('Recipient is invalid')
        } else {
            data.recipient = input.recipient
        }
    }

    if (has('location')) {
        const location = parseLocation(input.location, errors)
        if (location !== undefined) data.location = location
    }

    if (has('needsTransit')) {
        if (typeof input.needsTransit !== 'boolean') errors.push('needsTransit must be true or false')
        else data.needsTransit = input.needsTransit
    }

    if (errors.length) throw httpError(400, 'Validation failed', errors)
    return data
}

async function assertRecipientInFamily(recipientId, familyId) {
    if (recipientId && !(await Task.recipientInFamily(recipientId, familyId))) {
        throw httpError(400, 'Validation failed', ['Recipient not found in this family'])
    }
}

// ---------- Status changes ----------
// Each action lists the statuses it starts from, who may run it, and what it sets.

const ACTIONS = {
    claim: {
        from: [TASK_STATUS.OPEN],
        allowed: () => true,
        conflict: (task) => task.status === TASK_STATUS.CLAIMED
            ? 'Task already claimed'
            : new Date(task.startAt).getTime() <= Date.now() ? 'This task is overdue and can no longer be claimed'
            : `Task is ${task.status} and cannot be claimed`,
        set: (_task, userId) => ({
            status: TASK_STATUS.CLAIMED, claimedBy: userId, claimedAt: new Date()
        }),
        event: EVENTS.TASK_CLAIMED
    },
    unclaim: {
        from: [TASK_STATUS.CLAIMED],
        allowed: (task, userId) => isClaimer(task, userId) || task.createdBy.toString() === userId,
        forbidden: 'Only the task creator or the person who claimed it can unclaim it',
        conflict: (task) => `Task is ${task.status} and cannot be unclaimed`,
        set: () => ({ status: TASK_STATUS.OPEN, claimedBy: null, claimedAt: null }),
        event: EVENTS.TASK_UNCLAIMED
    },
    start: {
        from: [TASK_STATUS.CLAIMED],
        allowed: (task, userId) => isClaimer(task, userId),
        forbidden: 'Only the person who claimed this task can start it',
        conflict: (task) => `Task is ${task.status} and cannot be started`,
        set: () => ({ status: TASK_STATUS.IN_PROGRESS })
    },
    complete: {
        from: [TASK_STATUS.CLAIMED, TASK_STATUS.IN_PROGRESS],
        allowed: (task, userId) => isClaimer(task, userId),
        forbidden: 'Only the person who claimed this task can complete it',
        conflict: (task) => `Task is ${task.status} and cannot be completed`,
        set: () => ({ status: TASK_STATUS.COMPLETED, completedAt: new Date() }),
        event: EVENTS.TASK_COMPLETED
    },
    cancel: {
        from: [TASK_STATUS.OPEN, TASK_STATUS.CLAIMED, TASK_STATUS.IN_PROGRESS],
        allowed: (task, userId, role) => isCreatorOrAdmin(task, userId, role) || isClaimer(task, userId),
        forbidden: 'Only the task creator, assigned person or an admin can cancel this task',
        conflict: (task) => `Task is ${task.status} and cannot be cancelled`,
        set: () => ({ status: TASK_STATUS.CANCELLED, cancelledAt: new Date() }),
        event: EVENTS.TASK_CANCELLED
    }
}

async function changeStatus(actionName, { familyId, taskId, userId, memberRole, expectedUpdatedAt }) {
    const action = ACTIONS[actionName]
    const task = await findTaskInFamily(familyId, taskId)
    if (expectedUpdatedAt && +new Date(task.updatedAt) !== +new Date(expectedUpdatedAt)) {
        throw httpError(409, 'This task changed. Please prepare a new proposal.')
    }

    // Status first: an open task has no claimer, so "not allowed" would be misleading
    if (!action.from.includes(task.status)) {
        throw httpError(409, action.conflict(task))
    }
    if (!action.allowed(task, userId, memberRole)) {
        throw httpError(403, action.forbidden)
    }
    if (actionName === 'claim' && new Date(task.startAt).getTime() <= Date.now()) {
        throw httpError(409, 'This task is overdue and can no longer be claimed')
    }

    // Two people claiming at once: only the first update matches, the other gets null
    const updated = await Task.updateTaskStatus(task, action.set(task, userId))

    if (!updated) {
        const latest = await Task.getTaskById(task._id)
        throw httpError(409, latest
            ? action.conflict(latest)
            : 'Task was changed by someone else. Refresh and try again.')
    }

    return updated
}

// Shared completion function for E's "home" milestone (see docs/OWNERSHIP.md).
// Same rules as POST /:taskId/complete. Throws errors with .status on failure.
export async function completeTask({ familyId, taskId, userId, memberRole = 'member', expectedUpdatedAt }) {
    const task = await changeStatus('complete', { familyId, taskId, userId, memberRole, expectedUpdatedAt })
    await Task.endTransitSession(task)
    const populated = await Task.getPopulatedTaskById(task._id)
    await announce(EVENTS.TASK_COMPLETED, populated)
    return populated
}

// Used by both HTTP actions and confirmed assistant proposals.
export async function performFamilyTaskAction(actionName, context) {
    if (!Object.hasOwn(ACTIONS, actionName)) throw httpError(400, 'Unsupported task action')
    if (actionName === 'complete') return { task: await completeTask(context) }
    const task = await changeStatus(actionName, context)
    if (actionName === 'cancel') await Task.endTransitSession(task)
    let transitSession = null
    if (actionName === 'start') {
        try { transitSession = await Task.startTransitSession(task) }
        catch (error) {
            await Task.updateTaskStatus(task, { status: TASK_STATUS.CLAIMED })
            throw error
        }
    }
    const populated = await Task.getPopulatedTaskById(task._id)
    if (ACTIONS[actionName].event) await announce(ACTIONS[actionName].event, populated)
    return actionName === 'start' ? { task: populated, transitSession } : { task: populated }
}

function statusHandler(actionName) {
    return async (req, res, next) => {
        try {
            const context = {
                familyId: req.family._id,
                taskId: req.params.taskId,
                userId: req.user.userId,
                memberRole: req.memberRole
            }

            return res.json(await performFamilyTaskAction(actionName, context))
        } catch (error) {
            return handleError(error, res, next)
        }
    }
}

// ---------- Handlers ----------

// GET /api/families/:familyId/tasks
// Query (all optional): status=open,claimed  recipient=<id>|none
//                       claimedBy=me|<userId>  from=<date>  to=<date>
export async function listTasks(req, res, next) {
    try {
        const { status, recipient, claimedBy, from, to } = req.query
        const filter = {}
        const errors = []

        if (status !== undefined) {
            const statuses = String(status).split(',').map((s) => s.trim()).filter(Boolean)
            const invalid = statuses.filter((s) => !TASK_STATUSES.includes(s))
            if (invalid.length || !statuses.length) {
                errors.push(`Status must be one or more of: ${TASK_STATUSES.join(', ')}`)
            } else {
                filter.status = { $in: statuses }
            }
        }

        if (recipient !== undefined) {
            if (recipient === 'none') filter.recipient = null
            else if (mongoose.isValidObjectId(recipient)) filter.recipient = recipient
            else errors.push('Recipient is invalid')
        }

        if (claimedBy !== undefined) {
            if (claimedBy === 'me') filter.claimedBy = req.user.userId
            else if (mongoose.isValidObjectId(claimedBy)) filter.claimedBy = claimedBy
            else errors.push('claimedBy must be "me" or a user id')
        }

        if (from !== undefined || to !== undefined) {
            filter.startAt = {}
            if (from !== undefined) {
                const fromDate = parseDate(from)
                if (!fromDate) errors.push('from must be a valid date')
                else filter.startAt.$gte = fromDate
            }
            if (to !== undefined) {
                const toDate = parseDate(to)
                if (!toDate) errors.push('to must be a valid date')
                else filter.startAt.$lte = toDate
            }
        }

        if (errors.length) throw httpError(400, 'Validation failed', errors)

        const tasks = await Task.getTasksByFamily(req.family._id, filter)
        return res.json({ tasks })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// GET /api/families/:familyId/tasks/:taskId
export async function getTask(req, res, next) {
    try {
        const task = await findTaskInFamily(req.family._id, req.params.taskId)
        return res.json({ task: await Task.getPopulatedTaskById(task._id) })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// POST /api/families/:familyId/tasks
// New tasks are always open; status and claimedBy in the body are ignored.
export async function createTask(req, res, next) {
    try {
        const populated = await createFamilyTask({ body: req.body, familyId: req.family._id, userId: req.user.userId })
        return res.status(201).json({ task: populated })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// PATCH /api/families/:familyId/tasks/:taskId   (creator only)
export async function updateTask(req, res, next) {
    try {
        const populated = await updateFamilyTask({ body: req.body, familyId: req.family._id,
            taskId: req.params.taskId, userId: req.user.userId, memberRole: req.memberRole })
        return res.json({ task: populated })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// Shared by the task form and the assistant's explicit confirmation endpoint.
export async function createFamilyTask({ body, familyId, userId, taskId }) {
    const data = parseTaskInput(body, { partial: false })
    await assertRecipientInFamily(data.recipient, familyId)
    if (data.endAt && data.endAt < data.startAt) {
        throw httpError(400, 'End time must be after the start time')
    }
    const task = await Task.createTask({ ...data, ...(taskId ? { _id: taskId } : {}),
        family: familyId, createdBy: userId, status: TASK_STATUS.OPEN })
    const populated = await Task.getPopulatedTaskById(task._id)
    await announce(EVENTS.TASK_CREATED, populated)
    return populated
}

export async function updateFamilyTask({ body, familyId, taskId, userId, memberRole, expectedUpdatedAt }) {
    const task = await findTaskInFamily(familyId, taskId)

    if (task.createdBy.toString() !== userId) {
        throw httpError(403, 'Only the task creator can edit this task')
    }
    if (LOCKED_STATUSES.includes(task.status)) {
        throw httpError(409, `Task is ${task.status} and can no longer be edited`)
    }

    // Only editable fields are picked, so status and claimedBy are ignored
    const changes = parseTaskInput(body, { partial: true })
    if (!Object.keys(changes).length) {
        throw httpError(400, 'Validation failed', ['Nothing to update'])
    }

    await assertRecipientInFamily(changes.recipient, familyId)

    const startAt = changes.startAt ?? task.startAt
    const endAt = changes.endAt !== undefined ? changes.endAt : task.endAt
    if (endAt && endAt < startAt) {
        throw httpError(400, 'Validation failed', ['End time must be after the start time'])
    }

    // Status guard: if it was completed/cancelled meanwhile, don't edit it
    const updated = await Task.updateEditableTask(familyId, task._id, changes, expectedUpdatedAt)
    if (!updated) {
        throw httpError(409, 'Task was changed by someone else. Refresh and try again.')
    }

    const populated = await Task.getPopulatedTaskById(updated._id)
    announce('task.updated', populated)
    return populated
}

// DELETE /api/families/:familyId/tasks/:taskId   (creator only)
// in_progress and completed tasks can't be deleted; cancel them instead.
export async function deleteTask(req, res, next) {
    try {
        const task = await findTaskInFamily(req.family._id, req.params.taskId)

        if (task.createdBy.toString() !== req.user.userId) {
            throw httpError(403, 'Only the task creator can delete this task')
        }
        if (UNDELETABLE_STATUSES.includes(task.status)) {
            throw httpError(409, `Task is ${task.status} and cannot be deleted. Cancel it instead.`)
        }

        const result = await Task.deleteDeletableTask(req.family._id, task._id)
        if (!result.deletedCount) {
            throw httpError(409, 'Task was changed by someone else. Refresh and try again.')
        }

        announce('task.deleted', { taskId: task._id.toString() })
        return res.json({ message: 'Task deleted', taskId: task._id.toString() })
    } catch (error) {
        return handleError(error, res, next)
    }
}

// POST /api/families/:familyId/tasks/:taskId/<action>
export const claimTask = statusHandler('claim')
export const unclaimTask = statusHandler('unclaim')
export const startTask = statusHandler('start')
export const completeTaskHandler = statusHandler('complete')
export const cancelTask = statusHandler('cancel')
