// Owner: Chaithra (E)
// "Sync to Google Calendar" on My Tasks: downloads an .ics file of your upcoming tasks.
// Google Calendar: Settings → Import & export → Import. Apple Calendar and Outlook open it directly.

function icsDate(value) {
    // 2026-10-09T02:00:00.000Z -> 20261009T020000Z
    return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeText(text = '') {
    return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function downloadTasksAsCalendar(tasks) {
    const now = icsDate(Date.now())
    const events = tasks.map((task) => {
        const start = new Date(task.startAt)
        const end = task.endAt ? new Date(task.endAt) : new Date(start.getTime() + 60 * 60 * 1000)
        const place = [task.location?.name, task.location?.address].filter(Boolean).join(', ')
        return [
            'BEGIN:VEVENT',
            `UID:${task._id}@carecircle`,
            `DTSTAMP:${now}`,
            `DTSTART:${icsDate(start)}`,
            `DTEND:${icsDate(end)}`,
            `SUMMARY:${escapeText(task.title)}`,
            place ? `LOCATION:${escapeText(place)}` : '',
            `DESCRIPTION:${escapeText(`${task.family?.name || 'CareCircle'} · ${task.description || ''}`)}`,
            'END:VEVENT'
        ].filter(Boolean).join('\r\n')
    })

    const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CareCircle//My tasks//EN', ...events, 'END:VCALENDAR'].join('\r\n')
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: 'carecircle-my-tasks.ics' })
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}
