// Owner: Chaithra (E). Dev helper for testing/demoing the live map trail.
// Draws a pretend trip on an ACTIVE transit session: the companion left Toa Payoh a few
// minutes ago and is now halfway to TTSH, so the map shows their photo pin and the
// trail behind them.
//
//   node server/simulate-trail.js                 (Jasmine's eye check-up trip)
//   node server/simulate-trail.js <taskId>        (any other active trip)
//
// It resets that trip's timeline to just "Departed home". Only touches that one trip. Uses the same database as server/.env.
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const taskId = process.argv[2] || '6ac889894757422a93937349'

// Toa Payoh Lor 1 -> towards Novena, one point per minute (stops halfway)
const ROUTE = [
    [1.3375, 103.8505], [1.3368, 103.8490], [1.3360, 103.8476], [1.3352, 103.8462],
    [1.3343, 103.8452], [1.3334, 103.8447]
]

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from server/.env')
    if (!mongoose.isValidObjectId(taskId)) throw new Error(`"${taskId}" is not a valid task id`)

    await mongoose.connect(process.env.MONGODB_URI)
    const sessions = mongoose.connection.collection('transitsessions')

    const session = await sessions.findOne({ task: new mongoose.Types.ObjectId(taskId) })
    if (!session) throw new Error('No transit session for that task. Start the trip first.')
    if (session.status !== 'active') throw new Error('That trip has ended. Resume it first (Resume transit).')

    const now = Date.now()
    const points = ROUTE.map(([lat, lng], i) => ({
        lat,
        lng,
        at: new Date(now - (ROUTE.length - 1 - i) * 60 * 1000)
    }))

    const departed = { type: 'departed', label: 'Departed home', at: points[0].at, lat: points[0].lat, lng: points[0].lng }
    await sessions.updateOne(
        { _id: session._id },
        {
            $set: {
                path: points,
                lastLocation: points[points.length - 1],
                milestones: [departed],
                startedAt: points[0].at
            }
        }
    )
    console.log(`Done: ${points.length} points drawn, timeline reset to "Departed home".`)
    console.log('Open the Transit page (not as the companion) to see the photo pin and trail.')
}

main()
    .catch((error) => {
        console.error('Could not draw the trail:', error.message)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())
