// Placeholder data for the Family Home sections that aren't built yet.
// Only the avatars are filled in; every empty text field shows as a blank bar,
// so it's obvious in a demo which parts aren't implemented.
// Each owner replaces their part with real API data, then deletes it from here.

// E (Chaithra): replace with GET /families/:familyId/transit?status=active
export const transitSession = {
    recipientAvatar: '👴',
    companionAvatar: '👩',
    headline: '',
    detail: ''
}

// C (Jhen): replace with GET /families/:familyId/recipients
export const recipients = [
    { id: 'r1', avatar: '👴', name: '', summary: '', next: '', needsSomeone: 0 },
    { id: 'r2', avatar: '👵', name: '', summary: '', next: '', needsSomeone: 0 },
    { id: 'r3', avatar: '👶', name: '', summary: '', next: '', needsSomeone: 0 }
]

// F (SeungHak): replace with the family's notifications / activity feed
export const recentUpdates = [
    { id: 'u1', avatar: '👩', text: '', time: '' },
    { id: 'u2', avatar: '👩', text: '', time: '' },
    { id: 'u3', avatar: '👵', text: '', time: '' },
    { id: 'u4', avatar: '👦', text: '', time: '' }
]

// D (Marcus): replace with Socket.IO task events
export const liveToast = {
    avatar: '👵',
    message: ''
}
