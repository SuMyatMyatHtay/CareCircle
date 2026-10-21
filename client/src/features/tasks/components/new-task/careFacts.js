// Owner: Marcus (D)
// What a helper should know before taking a recipient out, as chips:
// severe allergies (coral), mobility (lavender), care notes (amber).
import { mobilityLabel } from '../../../recipients/recipientLabels.js'

// First sentence only, so a long note still fits on one chip
function short(text = '', max = 40) {
    const first = text.split(/[.;\n]/)[0].trim()
    return first.length > max ? `${first.slice(0, max - 1).trim()}…` : first
}

export function careFacts(recipient) {
    if (!recipient) return []

    const facts = (recipient.allergies || [])
        .filter((allergy) => allergy.severity === 'severe')
        .map((allergy) => ({ tone: 'coral', icon: 'bi-exclamation-triangle', text: `${allergy.name} · severe` }))

    const mobility = recipient.mobility?.notes ? short(recipient.mobility.notes) : mobilityLabel(recipient.mobility?.level)
    if (mobility) facts.push({ tone: 'lavender', text: mobility })

    if (recipient.careNotes) facts.push({ tone: 'amber', text: short(recipient.careNotes) })

    return facts
}
