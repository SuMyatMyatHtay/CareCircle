// Owner: Chaithra (E)
// Extra test data for My Tasks & Transit, added on top of SangYoon's resetFixtures().
// Only runs against the generated local test database (resetFixtures checks that first).
import { resetFixtures, ids } from './fixtures.js'
import { assertTestDatabase } from './database.js'
import Task from '../../src/features/tasks/TaskModel.js'
import TransitSession from '../../src/features/journeys/Journey.model.js'

export const transitIds = {
    ...ids,
    tripTask: '000000000000000000000401', // claimed by Alex, needs transit
    openTask: '000000000000000000000402'  // nobody has claimed it yet
}

// Tan Tock Seng Hospital and a spot about 100 m away (close points: no road lookup needed)
export const TTSH = { lat: 1.3214, lng: 103.8458 }
export const NEAR_TTSH = { lat: 1.3223, lng: 103.8458 }

export async function resetTransitFixtures() {
    await resetFixtures()
    assertTestDatabase()
    await TransitSession.deleteMany({})

    // Later today-ish, so the task is upcoming (not "Overdue") whenever the tests run
    const inHours = (h) => new Date(Date.now() + h * 60 * 60 * 1000)
    await Task.create([
        {
            _id: transitIds.tripTask,
            family: ids.family,
            recipient: ids.grandpa,
            title: 'Physio at TTSH',
            category: 'appointment',
            startAt: inHours(3),
            location: { name: 'Tan Tock Seng Hospital', address: '11 Jalan Tan Tock Seng', postal: '308433', ...TTSH },
            needsTransit: true,
            status: 'claimed',
            claimedBy: ids.alex,
            claimedAt: new Date(),
            createdBy: ids.jasmine
        },
        {
            _id: transitIds.openTask,
            family: ids.family,
            recipient: ids.grandpa,
            title: 'Eye check',
            category: 'appointment',
            startAt: inHours(4),
            location: { name: 'Tan Tock Seng Hospital', ...TTSH },
            needsTransit: true,
            createdBy: ids.jasmine
        }
    ])
    await TransitSession.init()
}
