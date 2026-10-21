// Owner: Su Myat Myat Htay (Sera)
import { authenticateUser, findCurrentUser, toPublicUser } from './service.js'
import User from './User.model.js'
import { validProfilePicture } from '../../utils/profilePicture.js'

export async function login(req, res) {
  try {
    const { email, password } = req.body ?? {}

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }
    

    const result = await authenticateUser(email, password)

    if (!result) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      ...result
    })

  } catch (error) {
    console.error('Login error:', error)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

export async function getCurrentUser(req, res) {
  try {
    const user = await findCurrentUser(req.user.userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    return res.status(200).json({
      success: true,
      user
    })

  } catch (error) {
    console.error('Get current user error:', error)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}


export async function logout(req, res) {
  try {
    const result = await User.updateOne(
      { _id: req.user.userId },
      { $inc: { tokenVersion: 1 } }
    )

    if (result.matchedCount === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    })

  } catch (error) {
    console.error('Logout error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to log out'
    })
  }
}

export async function updateProfile(req, res) {
  try {
    const { name, phone, preferredLang, telegramUsername, isCaretaker, profilePicture } = req.body ?? {}

    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      name.trim().length > 80
    ) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 80 characters.'
      })
    }

    if (
      typeof phone !== 'string' ||
      phone.trim().length > 30 ||
      typeof telegramUsername !== 'string' ||
      telegramUsername.trim().length > 32 ||
      !['en', 'zh', 'ms', 'ta'].includes(preferredLang)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please check your profile details.'
      })
    }

    if (typeof isCaretaker !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Caretaker status must be true or false.'
      })
    }

    if (profilePicture !== undefined && !validProfilePicture(profilePicture)) {
      return res.status(400).json({ message: 'Choose a valid profile picture.' })
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          ...(profilePicture !== undefined ? { profilePicture } : {}),
          name: name.trim(),
          phone: phone.trim(),
          preferredLang,
          telegramUsername: telegramUsername.trim()
        }
      },
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: toPublicUser(user)
    })

  } catch (error) {
    console.error('Update profile error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to update profile'
    })
  }
}