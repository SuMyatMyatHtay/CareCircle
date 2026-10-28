import mongoose from 'mongoose'
import Task, { LOCKED_STATUSES, UNDELETABLE_STATUSES } from '../tasks/TaskModel.js'
import Recipient from '../recipients/CareRecipient.model.js'
import Proposal from './Proposal.model.js'
import { parseTaskInput, createFamilyTask, updateFamilyTask, performFamilyTaskAction } from '../tasks/controller.js'
import Family from '../families/Family.model.js'
import User from '../auth/User.model.js'
import { syncInBackground } from '../calendar-sync/sync.js'
import { deleteRecurringOccurrence } from '../tasks/recurringService.js'
import { assistantError, generateReply, validateConversation } from './gemini.js'
import { TASK_STATUSES, TASK_CATEGORIES } from '../../constants.js'

const id = value => value?._id?.toString() || value?.toString()
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const statusActions = ['claim', 'assign', 'start', 'complete', 'cancel']
function editRefusal(task, userId) {
  if (id(task.createdBy) !== userId) return 'You cannot edit this task because you are not its creator. Being assigned to it or being a family admin does not grant editing permission.'
  if (LOCKED_STATUSES.includes(task.status)) return `You cannot edit this task because it is ${task.status}.`
  return ''
}
const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/
export function isoDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value) || Number.isNaN(Date.parse(value))) {
    throw assistantError(400, 'Please specify a valid date and time, including the time zone.')
  }
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(+day) || day.toISOString().slice(0, 10) !== value.slice(0, 10) || Number(value.slice(11, 13)) > 23) {
    throw assistantError(400, 'That calendar date or time is invalid. Please check it.')
  }
  return new Date(value)
}
export function taskSummary(task, recipients = []) {
  return { id: id(task), title: task.title, recipient: id(task.recipient) || null,
    recipientName: task.recipient?.nickname || task.recipient?.name ||
      recipients.find(person => id(person) === id(task.recipient))?.nickname ||
      recipients.find(person => id(person) === id(task.recipient))?.name || (task.recipient ? 'Care receiver' : 'Household'),
    startAt: task.startAt, endAt: task.endAt || null, location: task.location || null,
    category: task.category || 'other', needsTransit: task.needsTransit || false, status: task.status,
    createdBy: id(task.createdBy) || null, claimedBy: id(task.claimedBy) || null,
    recurringSeries: task.recurringSeries ? id(task.recurringSeries) : null,
    recurrenceDetached: task.recurrenceDetached || false, recurrenceLabel: task.recurrenceLabel || '',
    description: task.description || '' }
}

export async function validateDraft(reply, { familyId, userId, memberRole }) {
  if (statusActions.includes(reply.intent)) {
    if (!validId(reply.taskId)) throw assistantError(400, 'Which task do you mean?')
    const before = await Task.getTaskInFamily(familyId, reply.taskId)
    if (!before) throw assistantError(404, 'That task was not found in this family.')
    const creator = id(before.createdBy) === userId, claimer = id(before.claimedBy) === userId
    const changes = {}
    if (['claim', 'assign'].includes(reply.intent)) {
      if (before.status !== 'open') throw assistantError(409, 'Only an open task can be claimed or assigned. Release the existing claim first.')
      if (new Date(before.startAt) <= new Date()) throw assistantError(409, 'This task is overdue and can no longer be claimed or assigned.')
      if (reply.intent === 'assign') {
        if (!creator) throw assistantError(403, 'Only the task creator can assign this task.')
        const assigneeId = reply.assigneeId || reply.task?.assigneeId
        if (!validId(assigneeId)) throw assistantError(400, 'Which family member should take this task?')
        const family = await Family.findById(familyId)
        if (!family?.members.some(member => id(member.userId) === assigneeId)) throw assistantError(403, 'The assignee must be a current member of this family.')
        const assignee = await User.findById(assigneeId)
        if (!assignee) throw assistantError(404, 'That family member is no longer available.')
        changes.assigneeId = assigneeId
        changes.assigneeName = assignee.name || 'Family member'
      }
    } else if (reply.intent === 'start' || reply.intent === 'complete') {
      if (!claimer) throw assistantError(403, 'Only the person assigned to this task can start or complete it.')
      const allowed = reply.intent === 'start' ? ['claimed'] : ['claimed', 'in_progress']
      if (!allowed.includes(before.status)) throw assistantError(409, 'This task is no longer in a state where that action is available.')
    } else {
      if (!creator && !claimer) throw assistantError(403, 'You can only cancel a task you created or are assigned to.')
      if (!['open', 'claimed', 'in_progress'].includes(before.status)) throw assistantError(409, 'Only an active task can be cancelled.')
    }
    const nextStatus = { claim: 'claimed', assign: 'claimed', start: 'in_progress', complete: 'completed', cancel: 'cancelled' }[reply.intent]
    return { changes, before, preview: { ...taskSummary(before), status: nextStatus, assigneeName: changes.assigneeName } }
  }
  if (['unclaim', 'delete'].includes(reply.intent)) {
    if (!validId(reply.taskId)) throw assistantError(400, 'Which task do you mean?')
    const before = await Task.getTaskInFamily(familyId, reply.taskId)
    if (!before) throw assistantError(404, 'That task was not found in this family.')
    if (reply.intent === 'unclaim') {
      if (id(before.claimedBy) !== userId && id(before.createdBy) !== userId) throw assistantError(403, 'Only the task creator or the person who claimed it can unclaim this task.')
      if (before.status !== 'claimed') throw assistantError(409, 'Only a claimed task that has not started can be unclaimed.')
    } else {
      if (id(before.createdBy) !== userId) throw assistantError(403, 'You cannot delete this task because you are not its creator. Family admins cannot delete another member’s task.')
      if (UNDELETABLE_STATUSES.includes(before.status)) throw assistantError(409, `You cannot delete this task because it is ${before.status.replaceAll('_', ' ')}.`)
    }
    return { changes: {}, before, preview: { ...taskSummary(before), ...(reply.intent === 'unclaim' ? { status: 'open' } : {}) } }
  }
  let before = null
  if (reply.intent === 'update') {
    if (!validId(reply.taskId)) throw assistantError(400, 'Which task would you like to update?')
    before = await Task.getTaskInFamily(familyId, reply.taskId)
    if (!before) throw assistantError(404, 'That task was not found in this family.')
    const reason = editRefusal(before, userId)
    if (reason) throw assistantError(id(before.createdBy) !== userId ? 403 : 409, reason)
  }
  if (!plain(reply.task)) throw assistantError(400, 'Please provide the new task details before preparing a confirmation.')
  const source = reply.task
  // No model-provided ownership, status, assignment, family or database operators.
  const allowed = ['title', 'description', 'category', 'recipient', 'startAt', 'endAt', 'location', 'needsTransit']
  if (Object.keys(source).some(key => !allowed.includes(key))) throw assistantError(400, 'The assistant proposed unsupported task changes. Please try again.')
  for (const field of ['startAt', 'endAt']) {
    if (source[field] !== undefined && source[field] !== null) isoDate(source[field])
  }
  const changes = parseTaskInput(source, { partial: reply.intent === 'update' })
  if (!Object.keys(changes).length) throw assistantError(400, 'There are no task changes to confirm.')
  if (source.location && (!plain(source.location) || Object.keys(source.location).some(key => !['name', 'address', 'postal'].includes(key)))) {
    throw assistantError(400, 'Please specify a location name or address.')
  }
  const recipient = changes.recipient
    ? await Recipient.findOne({ _id: changes.recipient, family: familyId, isActive: true }) : null
  if (changes.recipient && !recipient) throw assistantError(400, 'That care receiver is not active in this family.')
  if (reply.intent !== 'update' && source.recipient === undefined) {
    throw assistantError(400, 'Who is this task for? Please specify a care receiver or household.')
  }
  const merged = { ...(before?.toObject?.() || before || {}), ...changes,
    family: familyId, createdBy: before?.createdBy || userId }
  // Validate the complete resulting task, including string lengths and end-time order.
  const validation = new Task(merged).validateSync()
  if (validation) throw assistantError(400, Object.values(validation.errors).map(error => error.message).join(' '))
  return { changes: JSON.parse(JSON.stringify(changes)), before, preview: taskSummary(merged, recipient ? [recipient] : []) }
}

export function searchFilter(search, familyId) {
  if (!plain(search)) throw assistantError(400, 'Please describe the tasks you want to find.')
  const filter = { family: familyId }
  if (search.query !== undefined) {
    if (typeof search.query !== 'string' || search.query.length > 120) throw assistantError(400, 'Use a shorter task search.')
    if (search.query.trim()) filter.title = { $regex: search.query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  }
  if (search.recipient !== undefined) {
    if (search.recipient !== null && !validId(search.recipient)) throw assistantError(400, 'Invalid care receiver.')
    filter.recipient = search.recipient
  }
  if (search.status !== undefined) {
    if (!TASK_STATUSES.includes(search.status)) throw assistantError(400, 'Invalid task status.')
    filter.status = search.status
  }
  if (search.category !== undefined) {
    if (!TASK_CATEGORIES.includes(search.category)) throw assistantError(400, 'Invalid task category.')
    filter.category = search.category
  }
  if (search.from || search.to) {
    filter.startAt = {}
    if (search.from) filter.startAt.$gte = isoDate(search.from)
    if (search.to) filter.startAt.$lte = isoDate(search.to)
    if (search.from && search.to && filter.startAt.$gte > filter.startAt.$lte) throw assistantError(400, 'The search end must be after its start.')
  }
  return filter
}

export async function chat({ body, familyId, familyName, userId, memberRole, generate = generateReply }) {
  const messages = validateConversation(body)
  let selectedTask = null
  let explicitEdit = null
  if (body.selectedTaskId) {
    if (!validId(body.selectedTaskId)) throw assistantError(400, 'Select a valid task from the results.')
    selectedTask = await Task.getTaskInFamily(familyId, body.selectedTaskId)
    if (!selectedTask) throw assistantError(404, 'That task was not found in this family.')
    if (body.selectTask === true) {
      const reason = editRefusal(selectedTask, userId)
      return { message: reason ? `Selected “${selectedTask.title}”. ${reason}` : `What would you like to do with “${selectedTask.title}”?`,
        suggestions: reason ? ['More task actions'] : ['Change title', 'Change time', 'Change location', 'More task actions'] }
    }
    const requested = messages.at(-1).content.trim().toLowerCase()
    const questions = {
      'change time': 'What new date and time should I use? Please include both if the date is changing.',
      'change location': 'What new location should I use?',
      'change title': 'What should the new task title be?',
      'change notes': 'What should the new task notes be?',
      'more task actions': 'Choose an action for this task. I will check your permissions before preparing a confirmation.'
    }
    if (questions[requested]) {
      const reason = requested !== 'more task actions' && editRefusal(selectedTask, userId)
      if (reason) return { message: reason, suggestions: [] }
      return { message: questions[requested], editField: { 'change title': 'title', 'change notes': 'description', 'change time': 'startAt', 'change location': 'location' }[requested],
        suggestions: requested === 'more task actions' ? ['Assign task', 'Start task', 'Complete task', 'Cancel task'] : [] }
    }
    if (body.editField) {
      const reason = editRefusal(selectedTask, userId)
      if (reason) return { message: reason, suggestions: [] }
      if (['never mind', 'nevermind', 'cancel edit', 'stop editing'].includes(requested)) return { message: 'Edit dismissed. No changes saved.', suggestions: [] }
      if (['title', 'description'].includes(body.editField)) {
        explicitEdit = { intent: 'update', taskId: id(selectedTask), task: { [body.editField]: messages.at(-1).content.trim() } }
      }
    }
  }
  const [recipients, recent] = await Promise.all([
    Recipient.find({ family: familyId, isActive: true }).select('name nickname').sort({ name: 1 }).limit(100).lean(),
    Task.find({ family: familyId, startAt: { $gte: new Date(Date.now() - 30 * 86400000) } })
      .select('title recipient startAt endAt location category needsTransit status createdBy claimedBy recurringSeries recurrenceDetached recurrenceLabel')
      .sort({ startAt: 1 }).limit(80).lean()
  ])
  const family = await Family.findById(familyId)
  const memberIds = family?.members.map(member => member.userId) || []
  const members = await User.find({ _id: { $in: memberIds } }).select('name').lean()
  const context = { family: familyName, userId, role: memberRole,
    selectedTask: selectedTask ? taskSummary(selectedTask, recipients) : null,
    members: members.map(member => ({ id: id(member), name: member.name })),
    recipients: recipients.map(person => ({ id: id(person), name: person.name, nickname: person.nickname })),
    tasks: recent.map(task => ({ ...taskSummary(task, recipients),
      canUnclaim: task.status === 'claimed' && (id(task.claimedBy) === userId || id(task.createdBy) === userId),
      canDelete: !UNDELETABLE_STATUSES.includes(task.status) && id(task.createdBy) === userId,
      canEdit: !LOCKED_STATUSES.includes(task.status) &&
      id(task.createdBy) === userId,
      canClaim: task.status === 'open' && new Date(task.startAt) > new Date(),
      canAssign: task.status === 'open' && id(task.createdBy) === userId && new Date(task.startAt) > new Date(),
      canStart: task.status === 'claimed' && id(task.claimedBy) === userId,
      canComplete: ['claimed', 'in_progress'].includes(task.status) && id(task.claimedBy) === userId,
      canCancel: ['open', 'claimed', 'in_progress'].includes(task.status) && (id(task.createdBy) === userId || id(task.claimedBy) === userId) })) }
  const reply = explicitEdit || await generate({ messages, context: { ...context, editField: body.editField || null } })
  if (!reply.taskId && selectedTask && !['reply', 'search', 'create'].includes(reply.intent)) reply.taskId = id(selectedTask)
  if (reply.intent === 'update' && (!plain(reply.task) || !Object.keys(reply.task).length)) {
    if (reply.taskId) {
      const task = await Task.getTaskInFamily(familyId, reply.taskId)
      if (!task) throw assistantError(404, 'That task was not found in this family.')
      const reason = editRefusal(task, userId)
      if (reason) return { message: reason, suggestions: [] }
    }
    return { message: 'What would you like to change? Tell me the new date and time, location, title or notes.', suggestions: ['Change time', 'Change location', 'Change title'] }
  }
  if (reply.intent === 'create') {
    const source = plain(reply.task) ? reply.task : {}
    const missing = !source.title?.trim?.() ? 'What is the task title?'
      : source.recipient === undefined ? 'Who is this task for? Choose a family care recipient or say household.'
      : !source.startAt ? 'What date and time should the task start?'
      : source.location === undefined ? 'Where will the task take place? You can also say no location.' : ''
    if (missing) return { message: missing, suggestions: [] }
  }
  if (reply.intent === 'assign' && !reply.assigneeId && !reply.task?.assigneeId) return { message: 'Which family member should take this task?', suggestions: members.slice(0, 4).map(member => member.name) }
  if (reply.intent === 'reply') return { message: reply.message, suggestions: reply.suggestions }
  if (reply.intent === 'search') {
    const results = await Task.find(searchFilter(reply.search || {}, familyId))
      .select('title recipient startAt endAt location category needsTransit status recurringSeries recurrenceDetached recurrenceLabel').sort({ startAt: 1 }).limit(11).lean()
    return { message: results.length ? 'Here are the matching tasks. Choose one if you want to make changes.' : 'I couldn’t find matching tasks. Try a different name, keyword or date.',
      tasks: results.slice(0, 10).map(task => taskSummary(task, recipients)), hasMore: results.length > 10, suggestions: [] }
  }
  if (!['create', 'update', 'unclaim', 'delete', ...statusActions].includes(reply.intent)) throw assistantError(502, 'Please try describing your task again.')
  const { changes, before, preview } = await validateDraft(reply, { familyId, userId, memberRole })
  const taskId = before?._id || new mongoose.Types.ObjectId()
  const proposal = await Proposal.create({ family: familyId, user: userId, action: reply.intent, taskId,
    changes, expectedUpdatedAt: before?.updatedAt, expiresAt: new Date(Date.now() + 15 * 60000) })
  // Names in the confirmation card always come from this family's database.
  const allRecipients = recipients
  const after = { ...preview, id: id(taskId), recipientName: allRecipients.find(person => id(person) === preview.recipient)?.nickname ||
    allRecipients.find(person => id(person) === preview.recipient)?.name || preview.recipientName }
  return { message: 'Please review the details below. Nothing changes until you confirm.', suggestions: [],
    proposal: { id: id(proposal), action: reply.intent, task: after, changes,
      before: before ? taskSummary(before, allRecipients) : null, expiresAt: proposal.expiresAt } }
}

export async function confirm({ proposalId, familyId, userId, memberRole }) {
  if (!validId(proposalId)) throw assistantError(404, 'Task proposal not found.')
  const scope = { _id: proposalId, family: familyId, user: userId }
  const proposal = await Proposal.findOne(scope)
  if (!proposal) throw assistantError(404, 'Task proposal not found.')
  if (proposal.expiresAt <= new Date()) throw assistantError(410, 'This proposal expired. Ask the assistant to prepare it again.')
  if (proposal.state === 'completed') {
    if (proposal.action === 'delete') return { deleted: true, taskId: id(proposal.taskId) }
    const task = await Task.getTaskInFamily(familyId, proposal.taskId)
    if (!task) throw assistantError(404, 'The saved task no longer exists.')
    return { task: await Task.getPopulatedTaskById(task._id) }
  }
  if (proposal.action === 'delete' && proposal.state === 'pending' && !proposal.deletionAcknowledged) {
    await validateDraft({ intent: 'delete', taskId: id(proposal.taskId) }, { familyId, userId, memberRole })
    const acknowledged = await Proposal.findOneAndUpdate({ ...scope, state: 'pending', deletionAcknowledged: { $ne: true } },
      { $set: { deletionAcknowledged: true } }, { new: true })
    if (!acknowledged) throw assistantError(409, 'Confirmation changed. Please try again.')
    return { requiresSecondConfirmation: true, message: 'Delete this task permanently? This cannot be undone. Confirm once more to delete it.' }
  }
  // A create has a reserved ID: recover a successful write even if the response was lost.
  if (proposal.state === 'processing' && proposal.action === 'create') {
    const task = await Task.getTaskInFamily(familyId, proposal.taskId)
    if (task) {
      await Proposal.updateOne(scope, { $set: { state: 'completed' } })
      return { task: await Task.getPopulatedTaskById(task._id) }
    }
  }
  const claimed = await Proposal.findOneAndUpdate({ ...scope, state: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { state: 'processing' } }, { new: true })
  if (!claimed) throw assistantError(409, 'This proposal is no longer available or is already being saved. Check your tasks before trying again.')
  let task
  try {
    // Re-check current permissions, active recipient and full validation at confirmation.
    const { changes, before } = await validateDraft({ intent: proposal.action, taskId: id(proposal.taskId), task: proposal.changes },
      { familyId, userId, memberRole })
    if ([...statusActions, 'unclaim'].includes(proposal.action)) {
      const result = await performFamilyTaskAction(proposal.action === 'assign' ? 'claim' : proposal.action, {
        familyId, taskId: proposal.taskId, userId: proposal.action === 'assign' ? changes.assigneeId : userId,
        memberRole, expectedUpdatedAt: proposal.expectedUpdatedAt
      })
      task = result.task
      syncInBackground(userId, id(before.claimedBy), id(task.claimedBy))
    } else if (proposal.action === 'delete') {
      if (+new Date(before.updatedAt) !== +new Date(proposal.expectedUpdatedAt)) throw assistantError(409, 'This task changed. Please prepare a new proposal.')
      const filter = { _id: before._id, family: familyId, updatedAt: new Date(proposal.expectedUpdatedAt), status: before.status, claimedBy: before.claimedBy ?? null }
      const result = before.recurringSeries
        ? (await deleteRecurringOccurrence(before, proposal.expectedUpdatedAt), { deletedCount: 1 })
        : await Task.deleteOne(filter)
      if (!result.deletedCount) throw assistantError(409, 'This task changed. Please prepare a new proposal.')
      syncInBackground(userId, id(before.claimedBy))
    } else task = proposal.action === 'create'
      ? await createFamilyTask({ body: changes, familyId, userId, taskId: proposal.taskId })
      : await updateFamilyTask({ body: changes, familyId, userId, memberRole, taskId: proposal.taskId,
        expectedUpdatedAt: proposal.expectedUpdatedAt })
  } catch (error) {
    // Unknown DB failures may have committed; do not make a potentially repeated write retryable.
    if (error.status || error instanceof mongoose.Error.ValidationError) {
      await Proposal.updateOne(scope, { $set: { state: 'failed' } })
    }
    throw error
  }
  await Proposal.updateOne(scope, { $set: { state: 'completed' } })
  if (proposal.action === 'delete') return { deleted: true, taskId: id(proposal.taskId) }
  return { task }
}

export async function cancel({ proposalId, familyId, userId }) {
  if (!validId(proposalId)) throw assistantError(404, 'Task proposal not found.')
  await Proposal.updateOne({ _id: proposalId, family: familyId, user: userId, state: 'pending' }, { $set: { state: 'cancelled' } })
  return { message: 'Proposal dismissed. No changes saved.' }
}
