// Package B: member management and invitations on A's existing Family model.
import { randomBytes } from 'node:crypto'
import mongoose from 'mongoose'
import Family from './Family.model.js'

const PUBLIC_FIELDS = 'name email preferredLang telegramUsername'
const adminCount = {
  $size: {
    $filter: {
      input: '$members',
      as: 'member',
      cond: { $eq: ['$$member.role', 'admin'] },
    },
  },
}

function publicMember(member) {
  const user = member.userId
  return {
    user: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      preferredLang: user.preferredLang || 'en',
      telegramUsername: user.telegramUsername || '',
    },
    role: member.role,
    joinedAt: member.joinedAt,
  }
}
function findMember(req) {
  if (!mongoose.isValidObjectId(req.params.userId)) return null
  return req.family.members.find(
    (member) => member.userId.toString() === req.params.userId,
  )
}
function writeFilter(req, targetId, protectAdmin) {
  // Recheck the actor's membership/role at write time, after the route guards.
  // This also prevents concurrent admin demotions/removals leaving no admin.
  const actor = { userId: req.user.userId }
  if (req.memberRole === 'admin') actor.role = 'admin'
  const clauses = [
    { members: { $elemMatch: actor } },
    { members: { $elemMatch: { userId: targetId } } },
  ]
  if (protectAdmin)
    clauses.push({
      $or: [
        {
          members: { $elemMatch: { userId: targetId, role: { $ne: 'admin' } } },
        },
        { $expr: { $gt: [adminCount, 1] } },
      ],
    })
  return { _id: req.family._id, $and: clauses }
}

export async function listMembers(req, res, next) {
  try {
    await req.family.populate('members.userId', PUBLIC_FIELDS)
    return res.json({
      members: req.family.members
        .filter((member) => member.userId)
        .map(publicMember),
    })
  } catch (error) {
    next(error)
  }
}
export async function updateMember(req, res, next) {
  try {
    if (req.memberRole !== 'admin')
      return res
        .status(403)
        .json({ error: 'Only family admins can change roles' })
    const keys = Object.keys(req.body || {})
    if (
      keys.length !== 1 ||
      keys[0] !== 'role' ||
      !['admin', 'member'].includes(req.body.role)
    )
      return res
        .status(400)
        .json({ error: 'Provide a role of admin or member' })
    if (!findMember(req))
      return res.status(404).json({ error: 'Member not found in this family' })
    const family = await Family.findOneAndUpdate(
      writeFilter(req, req.params.userId, req.body.role === 'member'),
      { $set: { 'members.$[target].role': req.body.role } },
      {
        new: true,
        runValidators: true,
        arrayFilters: [
          { 'target.userId': new mongoose.Types.ObjectId(req.params.userId) },
        ],
      },
    ).populate('members.userId', PUBLIC_FIELDS)
    if (!family)
      return res.status(409).json({
        error:
          'The family needs at least one admin, or membership changed. Refresh and try again.',
      })
    const member = family.members.find(
      (entry) => entry.userId?._id.toString() === req.params.userId,
    )
    if (!member) return res.status(404).json({ error: 'Member not found' })
    return res.json({ member: publicMember(member) })
  } catch (error) {
    next(error)
  }
}
export async function deleteMember(req, res, next) {
  try {
    if (req.memberRole !== 'admin' && req.params.userId !== req.user.userId)
      return res
        .status(403)
        .json({ error: 'Only admins can remove other members' })
    if (!findMember(req))
      return res.status(404).json({ error: 'Member not found in this family' })
    const family = await Family.findOneAndUpdate(
      writeFilter(req, req.params.userId, true),
      { $pull: { members: { userId: req.params.userId } } },
      { new: true },
    )
    if (!family)
      return res.status(409).json({
        error:
          'The last admin cannot leave or be removed. Refresh and try again.',
      })
    return res.status(204).end()
  } catch (error) {
    next(error)
  }
}
export async function regenerateInviteCode(req, res, next) {
  try {
    if (req.memberRole !== 'admin')
      return res
        .status(403)
        .json({ error: 'Only family admins can regenerate invite codes' })
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const inviteCode = randomBytes(5).toString('hex').toUpperCase()
        if (inviteCode === req.family.inviteCode) continue
        const family = await Family.findOneAndUpdate(
          {
            _id: req.family._id,
            members: { $elemMatch: { userId: req.user.userId, role: 'admin' } },
          },
          { $set: { inviteCode } },
          { new: true, runValidators: true },
        )
        if (!family)
          return res.status(409).json({
            error: 'Your admin membership changed. Refresh and try again.',
          })
        return res.json({ inviteCode: family.inviteCode })
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.inviteCode) continue
        throw error
      }
    }
    return res.status(503).json({
      error: 'Couldn’t create a unique invite code. Please try again.',
    })
  } catch (error) {
    next(error)
  }
}
