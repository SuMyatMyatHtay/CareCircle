// Owner: Chaithra (E)
// "Add to Google Calendar" for one task: opens Google Calendar with the event filled in.
// No login or API key needed; the person just clicks Save in Google Calendar.

function googleDate(value) {
    // 2026-10-09T02:00:00.000Z -> 20261009T020000Z
    return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function googleCalendarUrl(task) {
    const start = new Date(task.startAt)
    const end = task.endAt ? new Date(task.endAt) : new Date(start.getTime() + 60 * 60 * 1000)
    const place = [task.location?.name, task.location?.address, task.location?.postal ? `S${task.location.postal}` : '']
        .filter(Boolean).join(', ')

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: task.title,
        dates: `${googleDate(start)}/${googleDate(end)}`,
        details: [task.description, `From CareCircle: ${window.location.href}`].filter(Boolean).join('\n\n'),
        location: place
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
}
