// Owner: Su Myat Myat Htay 
import { randomBytes } from 'node:crypto'
import mongoose from 'mongoose'
import Family from './Family.model.js'
import User from '../auth/User.model.js'

// This function is to generate a random invitation code
function generateInviteCode() {
    return randomBytes(5).toString('hex').toUpperCase()
}

// This function is to format the family before sending to Vue
function formatFamily(family) {
    return {
        id: family._id.toString(),
        name: family.name,
        inviteCode: family.inviteCode,
        createdBy: family.createdBy.toString(),
        members: family.members.map(member => ({
        userId: member.userId.toString(),
        role: member.role,
        joinedAt: member.joinedAt
        })),
        createdAt: family.createdAt
    }
}

// Create family
export async function createFamilyForUser(name, userId) {

  // 1. Validate authenticated user ID
    if (!mongoose.isValidObjectId(userId)) {
        throw Object.assign(
        new Error('Invalid user ID'),
        { status: 401 }
        )
    }

    // 2. Check whether the user still exists
    const user = await User.findById(userId)
    if (!user) {
        throw Object.assign(
        new Error('User not found'),
        { status: 401 }
        )
    }

    // 3. Create family. Reply if an invite code collides
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
        const family = await Family.create({
            name: name.trim(),
            inviteCode: generateInviteCode(),
            createdBy: userId,
            members: [
            {
                userId,
                role: 'admin'
            }
            ]
        })

        // 4. Return the created family
        return formatFamily(family)

        } catch (error) {
        if (
            error.code === 11000 &&
            error.keyPattern?.inviteCode
        ) {
            continue
        }

        throw error
        }
    }

    throw new Error('Unable to generate unique invite code')
}

// This function is to retrieve all families that the logged-in user belongs to
export async function getFamiliesForUser(userId) {
    if (!mongoose.isValidObjectId(userId)) {
        return []
    }

    const families = await Family.find({
        'members.userId': userId
    }).sort({ createdAt: -1 })

    return families.map(formatFamily)
}
