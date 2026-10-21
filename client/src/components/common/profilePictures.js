export const profilePictures = ['alex', 'aunt-may', 'baby-emma', 'grandma', 'grandpa', 'jasmine', 'mia', 'mochi'].map(id => ({
  label: id.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' '),
  src: `/avatars/people/${id}.png`
}))
export function defaultProfilePicture(person = {}) {
  const defaults = { elderly: 'grandpa', pregnancy: 'mia', postpartum: 'aunt-may', infant: 'baby-emma', injury: 'alex', other: 'jasmine' }
  return `/avatars/people/${defaults[person.careType] || 'alex'}.png`
}
