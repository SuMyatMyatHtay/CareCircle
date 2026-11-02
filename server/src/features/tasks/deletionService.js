import mongoose from 'mongoose'
import Task from './TaskModel.js'
import Family from '../families/Family.model.js'
import User from '../auth/User.model.js'
import { deleteRecurringOccurrence } from './recurringService.js'
import { EVENTS } from '../../constants.js'
import { notify } from '../../utils/notify.js'
import { familyMember, canManageFamilyTasks, isOverdueOpenTask } from './permissions.js'

const error = (status, message) => Object.assign(new Error(message), { status })

export async function assertTaskDeletionAllowed(task, { familyId, userId }) {
  // Always read the current membership and setting, including at each confirmation.
  const family = await Family.findById(familyId)
  if (!familyMember(family, userId)) throw error(403, 'You are no longer a member of this family.')
  const overdue = isOverdueOpenTask(task)
  if (overdue ? !canManageFamilyTasks(family, userId) : String(task.createdBy?._id || task.createdBy) !== String(userId)) {
    throw error(403, overdue
      ? 'Your family settings allow only admins to delete overdue tasks.'
      : 'You cannot delete this task because you are not its creator.')
  }
  if (['in_progress', 'completed'].includes(task.status)) throw error(409, `You cannot delete this task because it is ${task.status.replaceAll('_', ' ')}.`)
  return { family, overdue }
}

// Shared by the manual endpoint and the assistant. Recurring deletion keeps its tombstone.
export async function deleteFamilyTask({ familyId, taskId, userId, expectedUpdatedAt }) {
  if (!mongoose.isValidObjectId(taskId)) throw error(404, 'Task not found')
  const task = await Task.getTaskInFamily(familyId, taskId)
  if (!task) throw error(404, 'Task not found')
  if (expectedUpdatedAt && +new Date(task.updatedAt) !== +new Date(expectedUpdatedAt)) throw error(409, 'This task changed. Please prepare a new proposal.')
  const { overdue } = await assertTaskDeletionAllowed(task, { familyId, userId })
  const actor = await User.findById(userId).select('name').lean()
  const populated = overdue ? null : await Task.getPopulatedTaskById(task._id)
  const filter = {
    _id: task._id, family: familyId, status: task.status, claimedBy: task.claimedBy ?? null,
    startAt: task.startAt, ...(task.updatedAt ? { updatedAt: new Date(task.updatedAt) } : {}),
  }
  const result = task.recurringSeries
    ? (await deleteRecurringOccurrence(task, expectedUpdatedAt || task.updatedAt), { deletedCount: 1 })
    : await Task.deleteOne(filter)
  if (!result.deletedCount) throw error(409, 'This task changed. Refresh and try again.')
  await notify(familyId, EVENTS.TASK_DELETED, overdue
    ? { deletedCount: 1, changedBy: actor }
    : { ...(populated?.toObject?.() || populated || task), changedBy: actor })
  return { taskId: String(task._id), claimedBy: task.claimedBy }
}
