// Owner: Sera (package A)
// Use after requireAuth on every /api/families/:familyId/... route.
//
//   router.use('/families/:familyId', requireAuth, requireFamilyMember)
//
// On success it sets:
//   req.family      the Family document (a full Mongoose doc, so controllers can .save() it)
//   req.memberRole  'admin' or 'member'
//
// Controllers must filter every query by req.family._id,
// never by a familyId taken from the body or query string.

import mongoose from 'mongoose'
import Family from '../features/families/Family.model.js'

export async function requireFamilyMember(req, res, next) {
  try {
    const userId = req.user?.userId
    if (!userId) {
      // requireAuth didn't run before this middleware
      return res.status(401).json({ error: 'Authentication token required' })
    }

    const { familyId } = req.params
    // A malformed id would make Mongoose throw a CastError, so treat it as not found
    if (!mongoose.isValidObjectId(familyId)) {
      return res.status(404).json({ error: 'Family not found' })
    }

    const family = await Family.findById(familyId)
    if (!family) {
      return res.status(404).json({ error: 'Family not found' })
    }

    const membership = family.members.find((m) => m.userId.toString() === userId)
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this family' })
    }

    req.family = family
    req.memberRole = membership.role
    return next()
  } catch (error) {
    return next(error)
  }
}

// Use after requireFamilyMember, on admin-only routes only:
//   router.post('/:familyId/invite-code', requireFamilyAdmin, regenerateInviteCode)
export function requireFamilyAdmin(req, res, next) {
  if (req.memberRole !== 'admin') {
    return res.status(403).json({ error: 'Only family admins can do this' })
  }
  return next()
}
