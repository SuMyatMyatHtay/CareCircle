const presets = ['alex', 'aunt-may', 'baby-emma', 'grandma', 'grandpa', 'jasmine', 'mia', 'mochi']
export function validProfilePicture(value) {
  return typeof value === 'string' && (value === '' ||
    presets.some(name => value === `/avatars/people/${name}.png`) ||
    (value.length <= 50000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)))
}
