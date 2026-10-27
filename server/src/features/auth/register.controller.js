import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from './User.model.js'
import { toPublicUser } from './service.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const languages = new Set(['en', 'zh', 'ms', 'ta'])

export async function register(req, res) {
  try {
    const { name, email, phone = '', preferredLang = 'en', password, confirmPassword, agreed } = req.body ?? {}
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 ||
        typeof email !== 'string' || email.length > 254 || !emailPattern.test(email.trim()) ||
        typeof phone !== 'string' || phone.trim().length > 30 ||
        !languages.has(preferredLang) || typeof password !== 'string' ||
        password.length < 8 || password.length > 128 ||
        (confirmPassword !== undefined && confirmPassword !== password) || agreed !== true) {
      return res.status(400).json({ success: false, message: 'Please check your registration details and accept the terms.' })
    }
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured')
    const normalizedEmail = email.trim().toLowerCase()
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({
      name: name.trim(), email: normalizedEmail, phone: phone.trim(), preferredLang,
      passwordHash, isCaretaker: false
    })
    const token = jwt.sign(
      { userId: user._id.toString(), tokenVersion: user.tokenVersion ?? 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1d', algorithm: 'HS256' }
    )
    return res.status(201).json({
      success: true, message: 'Account created successfully', token, user: toPublicUser(user)
    })
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' })
    }
    console.error('Register error:', error)
    return res.status(500).json({ success: false, message: 'Unable to create account right now.' })
  }
}
