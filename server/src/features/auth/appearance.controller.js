import User from './User.model.js'
import { toPublicUser } from './service.js'

export const APPEARANCES = ['light', 'dark', 'system']

// PATCH /api/auth/me/appearance { appearance }
// Its own endpoint so a theme change doesn't have to resend the whole profile.
export async function updateAppearance(req, res) {
  try {
    const { appearance } = req.body ?? {}
    if (!APPEARANCES.includes(appearance)) {
      return res.status(400).json({ success: false, message: 'Appearance must be light, dark or system.' })
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { appearance } },
      { new: true, runValidators: true }
    )

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    return res.json({ success: true, message: 'Appearance saved.', user: toPublicUser(user) })
  } catch (error) {
    console.error('Save appearance error:', error)
    return res.status(500).json({ success: false, message: 'Unable to save appearance.' })
  }
}
