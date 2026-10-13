import User from './User.model.js'
import { toPublicUser } from './service.js'
const allowed = {
  baseId: new Set(['base-01','base-02']),
  top: new Set(['','top-01','top-02']),
  bottom: new Set(['','bottom-01','bottom-02']),
  shoes: new Set(['','shoes-01','shoes-02']),
  accessory: new Set(['','accessory-01'])
}
export async function updateAvatar(req,res) {
  try {
    const {baseId,equipped} = req.body ?? {}
    if (!allowed.baseId.has(baseId) || !equipped || typeof equipped !== 'object' || Array.isArray(equipped) ||
      !allowed.top.has(equipped.top) || !allowed.bottom.has(equipped.bottom) ||
      !allowed.shoes.has(equipped.shoes) || !allowed.accessory.has(equipped.accessory)) {
      return res.status(400).json({success:false,message:'Invalid avatar appearance.'})
    }
    const user = await User.findByIdAndUpdate(req.user.userId, {$set:{
      'avatarAppearance.baseId':baseId,
      'avatarAppearance.equipped.top':equipped.top,
      'avatarAppearance.equipped.bottom':equipped.bottom,
      'avatarAppearance.equipped.shoes':equipped.shoes,
      'avatarAppearance.equipped.accessory':equipped.accessory
    }},{new:true,runValidators:true})
    if (!user) return res.status(404).json({success:false,message:'User not found.'})
    return res.json({success:true,message:'Avatar saved.',user:toPublicUser(user)})
  } catch (error) {
    console.error('Update avatar error:',error)
    return res.status(500).json({success:false,message:'Unable to save avatar.'})
  }
}
