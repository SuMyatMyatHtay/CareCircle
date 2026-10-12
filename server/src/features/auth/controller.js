// Owner: Su Myat Myat Htay (Sera)

import { authenticateUser, findCurrentUser } from './service.js'

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
