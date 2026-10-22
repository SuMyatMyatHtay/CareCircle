// Owner: Chaithra (E)
// One place for the words used on Part E buttons and labels, so the laptop and phone
// layouts always say the same thing. Change a word here and it changes everywhere.

export const WORDS = {
    // Trip actions
    startTrip: 'Start the trip',
    startTask: 'Start task',
    openTrip: 'Open the trip',
    viewTrip: 'View trip',
    endTrip: 'End the trip',
    resumeTrip: 'Resume the trip',
    postUpdate: 'Post the next update',
    safelyHome: 'Safely back home',

    // Task actions
    giveBack: 'Give back',
    markDone: 'Mark as done',
    addToCalendar: 'Add to calendar',
    directions: 'Directions',

    // Statuses
    live: 'Live',
    ended: 'Ended',
    claimed: 'Claimed',
    inProgress: 'In progress',
    done: 'Done',
    upcoming: 'Upcoming',

    // Notes
    tripEnded: 'Trip ended. The task is still in progress.',
    alsoOnTrip: 'Also on a trip:'
}

// The trip's fixed steps, same labels as the server's defaults (MILESTONE_LABELS)
export const TRIP_STEPS = [
    { type: 'departed', label: 'Departed home' },
    { type: 'arrived', label: 'Arrived at clinic' },
    { type: 'consultation_done', label: 'Consultation done' },
    { type: 'heading_home', label: 'Heading home' },
    { type: 'home', label: WORDS.safelyHome }
]

// Extra quick updates (saved as custom updates with this text)
export function extraUpdates(who) {
    return [who ? `Picked up ${who}` : 'Picked up', 'Seeing the doctor', 'Collecting medicine', 'Going for lunch']
}
