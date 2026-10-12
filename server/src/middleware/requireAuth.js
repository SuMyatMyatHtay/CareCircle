
import jwt from 'jsonwebtoken'
import User from '../features/auth/User.model.js'

export async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization

  const match = typeof authorization === 'string'
    ? /^Bearer\s+(\S+)$/i.exec(authorization)
    : null

  if (!match) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required'
    })
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured')
    }

    // Step 1: Verify JWT signature and expiration
    const payload = jwt.verify(
      match[1],
      process.env.JWT_SECRET,
      { algorithms: ['HS256'] }
    )

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.userId !== 'string'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      })
    }

    // Step 2: Retrieve user from MongoDB FIRST
    const user = await User.findById(payload.userId)

    // Step 3: Check user existence and token revocation
    if (
      !user ||
      payload.tokenVersion !== (user.tokenVersion ?? 0)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or revoked. Please log in again.'
      })
    }

    // Step 4: Attach authenticated user to request
    req.user = {
      userId: user._id.toString()
    }

    return next()

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token'
      })
    }

    console.error('Authentication error:', error)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}
