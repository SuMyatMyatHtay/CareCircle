import mongoose from 'mongoose'
import User from './User.model.js'
import Family from '../families/Family.model.js'
import Task from '../tasks/TaskModel.js'

export async function getPublicProfile(req, res, next) {
  try {
    const { userId } = req.params
    if (!mongoose.isValidObjectId(userId)) return res.status(404).json({ message: 'Profile not found.' })
    const families = await Family.find({ 'members.userId': { $all: [req.user.userId, userId] } }).select('_id').lean()
    if (userId !== req.user.userId && !families.length) return res.status(404).json({ message: 'Profile not found or unavailable to you.' })
    const user = await User.findById(userId).select('name profilePicture preferredLang isCaretaker avatarAppearance createdAt').lean()
    if (!user) return res.status(404).json({ message: 'Profile not found.' })
    const tasks = await Task.find({
      family: { $in: families.map(family => family._id) },
      claimedBy: userId,
      status: { $in: ['claimed', 'in_progress', 'completed'] },
    }).select('title status startAt completedAt').sort({ updatedAt: -1, _id: -1 }).limit(3).lean()
    return res.json({ user: {
      id: user._id.toString(), name: user.name, profilePicture: user.profilePicture || '',
      preferredLang: user.preferredLang, isCaretaker: user.isCaretaker ?? false,
      avatarAppearance: user.avatarAppearance ?? null, createdAt: user.createdAt,
      tasks,
    } })
  } catch (error) { next(error) }
}
