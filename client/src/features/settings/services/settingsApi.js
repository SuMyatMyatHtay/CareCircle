import { http } from '../../../services/http.js'
import { authConfig } from '../../family/services/dashboardApi.js'

export async function getMembers(familyId) {
  const { data } = await http.get(`/families/${familyId}/members`, authConfig())
  if (!Array.isArray(data.members))
    throw new Error('Invalid member data from server.')
  return data.members
}
export async function changeMemberRole(familyId, userId, role) {
  const { data } = await http.patch(
    `/families/${familyId}/members/${userId}`,
    { role },
    authConfig(),
  )
  return data.member
}
export async function removeMember(familyId, userId) {
  await http.delete(`/families/${familyId}/members/${userId}`, authConfig())
}
export async function regenerateInviteCode(familyId) {
  const { data } = await http.post(
    `/families/${familyId}/invite-code`,
    {},
    authConfig(),
  )
  return data.inviteCode
}
async function updateProfile(changes) {
  // A's current profile endpoint requires a complete profile, not a partial body.
  const config = authConfig()
  const authorization = config.headers.Authorization
  const assertSameSession = () => {
    if (`Bearer ${sessionStorage.getItem('token')}` !== authorization) {
      throw new Error('Your account changed while saving. Please try again.')
    }
  }
  const readProfile = (data) => {
    const profile = data?.user
    if (
      !profile ||
      typeof profile.id !== 'string' ||
      !profile.id ||
      typeof profile.name !== 'string'
    ) {
      throw new Error('Invalid profile data from the server. Please try again.')
    }
    return profile
  }
  const { data: current } = await http.get('/auth/me', config)
  assertSameSession()
  const user = readProfile(current)
  const { data } = await http.patch(
    '/auth/me',
    {
      name: user.name,
      phone: user.phone || '',
      telegramUsername: user.telegramUsername || '',
      isCaretaker: user.isCaretaker ?? false,
      preferredLang: user.preferredLang || 'en',
      ...changes,
    },
    config,
  )
  assertSameSession()
  const saved = readProfile(data)
  if (saved.id !== user.id)
    throw new Error('Invalid profile response. Please try again.')
  sessionStorage.setItem('user', JSON.stringify(saved))
  window.dispatchEvent(new Event('carecircle:profile-updated'))
  return saved
}
export function saveLanguage(preferredLang) {
  return updateProfile({ preferredLang })
}
export function saveProfile({ name, phone }) {
  return updateProfile({ name, phone })
}
