// Owner: SeungHak (F)
const SEEDED_RECIPIENTS = {
    '6ac889894757422a93937346': { name: 'Tan Ah Kow', nickname: 'Grandpa' },
    '6ac889894757422a93937347': { name: 'Lim Siew Lan', nickname: 'Grandma' },
    '6ac889894757422a93937348': { name: 'Emma Tan', nickname: 'Baby Emma' }
}

export function placeholderRecipient(recipientId) {
    return SEEDED_RECIPIENTS[recipientId] || null
}
