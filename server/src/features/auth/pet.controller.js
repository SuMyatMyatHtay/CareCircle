import User from './User.model.js'
import { toPublicUser } from './service.js'

const validIds = (prefix, count) => Array.from({length: count}, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`)
const tops = new Set(['', ...validIds('tops', 10)])
const bottoms = new Set(['', ...validIds('skirts', 16), ...validIds('shorts', 20)])
const shoes = new Set(['', ...validIds('shoes', 12)])

export async function updatePet(req, res) {
  try {
    const { species, name, equipped } = req.body ?? {}
    if (
      !['fox', 'cat'].includes(species) ||
      typeof name !== 'string' || name.trim().length > 30 ||
      !equipped || typeof equipped !== 'object' || Array.isArray(equipped) ||
      !tops.has(equipped.outfit) || !bottoms.has(equipped.bottom) || !shoes.has(equipped.shoes)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid pet appearance or outfit.' })
    }

    const user = await User.findByIdAndUpdate(req.user.userId, {
      $set: {
        'petAppearance.species': species,
        'petAppearance.name': name.trim(),
        'petAppearance.equipped.outfit': equipped.outfit,
        'petAppearance.equipped.bottom': equipped.bottom,
        'petAppearance.equipped.shoes': equipped.shoes
      }
    }, { new: true, runValidators: true })

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    return res.status(200).json({ success: true, message: 'Pet appearance saved.', user: toPublicUser(user) })
  } catch (error) {
    console.error('Update pet error:', error)
    return res.status(500).json({ success: false, message: 'Unable to save your pet.' })
  }
}
