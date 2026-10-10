
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from './User.js'

export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    preferredLang: user.preferredLang,
    telegramUsername: user.telegramUsername,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

export async function authenticateUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase()

  const user = await User.findOne({
    email: normalizedEmail
  }).select('+passwordHash')

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return null
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  const token = jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: '1d', algorithm: 'HS256' }
  )

  return {
    token,
    user: toPublicUser(user)
  }
}

export async function findCurrentUser(userId) {
  const user = await User.findById(userId)
  return user ? toPublicUser(user) : null
}
