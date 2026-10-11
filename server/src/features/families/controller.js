// Owner: Su Myat Myat Htay 
// Implement handler functions here and connect them from routes.js.


import {
  createFamilyForUser,
  getFamiliesForUser
} from './service.js'

// POST /api/families
export async function createFamily(req, res) {
    try {
        const { name } = req.body ?? {}
        if (
            typeof name !== 'string' ||
            name.trim().length < 2 ||
            name.trim().length > 80
        ) {
        return res.status(400).json({
            success: false,
            message: 'Family name must be 2–80 characters'
        })
        }

        const family = await createFamilyForUser(
            name,
            req.user.userId
        )

        return res.status(201).json({
        success: true,
        message: 'Family created successfully',
        family
        })

    } catch (error) {
        console.error('Create family error:', error)

        return res.status(error.status || 500).json({
        success: false,
        message: error.status
            ? error.message
            : 'Unable to create family'
        })
    }
}

// GET /api/families/mine
export async function getMyFamilies(req, res) {
    try {
        const families = await getFamiliesForUser(
        req.user.userId
        )

        return res.status(200).json({
        success: true,
        families
        })

    } catch (error) {
        console.error('Get families error:', error)

        return res.status(500).json({
        success: false,
        message: 'Unable to retrieve families'
        })
    }
}
