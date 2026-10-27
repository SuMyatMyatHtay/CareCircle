import Family from '../families/Family.model.js'
import CareRecipient from './CareRecipient.model.js'

// Keep the account link when inactive: tasks/logs and later reactivation use
// the original recipient id. The unique family+linkedUser index guards races.
export async function syncAccountRecipientInFamily(user, familyId) {
    const filter = { family: familyId, linkedUser: user._id }
    if (!user.isCaretaker) {
        await CareRecipient.updateMany(filter, { $set: { isActive: false } })
        return
    }
    const update = {
        $set: { isActive: true, name: user.name, profilePicture: user.profilePicture || '' },
        $setOnInsert: { careType: 'other' }
    }
    try {
        await CareRecipient.findOneAndUpdate(filter, update, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true })
    } catch (error) {
        if (error.code !== 11000) throw error
        // Another request inserted the same link first; reuse its record.
        await CareRecipient.findOneAndUpdate(filter, update, { new: true, runValidators: true })
    }
}

export async function syncAccountRecipients(user) {
    const families = await Family.find({ 'members.userId': user._id }).select('_id')
    for (const family of families) await syncAccountRecipientInFamily(user, family._id)
}
