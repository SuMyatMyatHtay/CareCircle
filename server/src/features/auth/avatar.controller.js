import User from './User.model.js'
import { toPublicUser } from './service.js'
const valid = (category,id) => id === '' || (typeof id==='string' && new RegExp(`^${category}-(0[1-9]|1[0-2])$`).test(id))
const bases = new Set(['cat','dog','fox','elephant','dinosaur','rabbit','chick','duck'])
export async function updateAvatar(req,res) {
 try {
  const {baseId,equipped}=req.body??{}
  if(!bases.has(baseId) || !equipped || typeof equipped!=='object' || Array.isArray(equipped) ||
     !valid('dresses',equipped.dress) || !valid('tops',equipped.top) ||
     !(valid('skirts',equipped.bottom)||valid('shorts',equipped.bottom)) ||
     !valid('shoes',equipped.shoes) || !valid('accessories',equipped.accessory) ||
     (equipped.dress && (equipped.top || equipped.bottom))) {
   return res.status(400).json({success:false,message:'Invalid avatar outfit or character.'})
  }

  if (['rabbit', 'chick', 'duck'].includes(baseId)) {
    return res.status(403).json({
      success: false,
      message: 'This character is coming soon! ♡'
    })
  }
  const user=await User.findByIdAndUpdate(req.user.userId,{$set:{
   'avatarAppearance.baseId':baseId,
   'avatarAppearance.equipped.dress':equipped.dress,
   'avatarAppearance.equipped.top':equipped.top,
   'avatarAppearance.equipped.bottom':equipped.bottom,
   'avatarAppearance.equipped.shoes':equipped.shoes,
   'avatarAppearance.equipped.accessory':equipped.accessory
  }},{new:true,runValidators:true})
  if(!user)return res.status(404).json({success:false,message:'User not found.'})
  return res.json({success:true,message:'Outfit saved successfully.',user:toPublicUser(user)})
 }catch(e){console.error('Save avatar error:',e);return res.status(500).json({success:false,message:'Unable to save outfit.'})}
}
