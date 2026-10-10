
import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
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

    req.user = { userId: payload.userId }
    return next()

  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token'
      })
    }

    console.error('Authentication middleware error:', error)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}
