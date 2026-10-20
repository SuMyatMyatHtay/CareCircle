// Owner: Chaithra (E)
// Middleware in front of D's tasks router: after any change to a task (claim, give back,
// start, complete, cancel, edit, delete) succeeds, update the Google Calendar of
// whoever it affects. D's code doesn't need to know about Google at all.
//   routes/index.js:  router.use('/families/:familyId/tasks', calendarAutoSync)
import mongoose from 'mongoose'
import Task from '../tasks/TaskModel.js'
import { isConfigured } from './google.js'
import { syncInBackground } from './sync.js'

export async function calendarAutoSync(req, res, next) {
    if (req.method === 'GET' || !isConfigured()) return next()

    try {
        // Who had the task before the change (e.g. the person giving it back)
        const taskId = req.path.split('/')[1]
        let claimerBefore = null
        if (mongoose.isValidObjectId(taskId)) {
            const before = await Task.findById(taskId).select('claimedBy')
            claimerBefore = before?.claimedBy
        }

        res.on('finish', async () => {
            if (res.statusCode >= 400) return
            let claimerAfter = null
            if (mongoose.isValidObjectId(taskId)) {
                const after = await Task.findById(taskId).select('claimedBy').catch(() => null)
                claimerAfter = after?.claimedBy
            }
            syncInBackground(req.user?.userId, claimerBefore, claimerAfter)
        })
    } catch {
        // Never block the task change because of calendar syncing
    }
    return next()
}
