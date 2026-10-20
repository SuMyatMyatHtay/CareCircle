// Owner: Chaithra (E)
// "Add to calendar" for one task, in the person's own calendar app. No login or API key:
//   Google Calendar  -> opens Google Calendar (app or website) with the event filled in
//   Outlook          -> opens Outlook on the web with the event filled in
//   Apple Calendar   -> opens the event in Calendar on iPhone / Mac (an .ics event, which
//                       Safari hands straight to the Calendar app)
// Used by AddToCalendar.vue.

const HOUR = 60 * 60 * 1000

function times(task) {
    const start = new Date(task.startAt)
    const end = task.endAt ? new Date(task.endAt) : new Date(start.getTime() + HOUR)
    return { start, end }
}

function place(task) {
    const loc = task.location || {}
    return [loc.name, loc.address, loc.postal ? `S${loc.postal}` : ''].filter(Boolean).join(', ')
}

function details(task) {
    const family = task.family?.name ? `${task.family.name} · ` : ''
    return [`${family}From CareCircle`, task.description].filter(Boolean).join('\n\n')
}

// 2026-10-09T02:00:00.000Z -> 20261009T020000Z
function compactUtc(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function googleCalendarUrl(task) {
    const { start, end } = times(task)
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: task.title,
        dates: `${compactUtc(start)}/${compactUtc(end)}`,
        details: details(task),
        location: place(task)
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookCalendarUrl(task) {
    const { start, end } = times(task)
    const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: task.title,
        startdt: start.toISOString(),
        enddt: end.toISOString(),
        body: details(task),
        location: place(task)
    })
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

function escapeText(text = '') {
    return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

// Opens one event in Apple Calendar. On iPhone/iPad and Mac Safari this shows the
// "Add to Calendar" screen; other browsers save a small calendar file instead.
export function openInAppleCalendar(task) {
    const { start, end } = times(task)
    const where = place(task)
    const event = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CareCircle//Task//EN',
        'BEGIN:VEVENT',
        `UID:${task._id}@carecircle`,
        `DTSTAMP:${compactUtc(new Date())}`,
        `DTSTART:${compactUtc(start)}`,
        `DTEND:${compactUtc(end)}`,
        `SUMMARY:${escapeText(task.title)}`,
        where ? `LOCATION:${escapeText(where)}` : '',
        `DESCRIPTION:${escapeText(details(task))}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].filter(Boolean).join('\r\n')

    const url = URL.createObjectURL(new Blob([event], { type: 'text/calendar' }))
    const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `${task.title.replace(/[^\w -]/g, '').trim() || 'task'}.ics`
    })
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
