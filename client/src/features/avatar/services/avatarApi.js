import axios from 'axios'
const client = axios.create({ baseURL: import.meta.env.VITE_API_URL, timeout: 10000 })
function config() {
  const token = sessionStorage.getItem('token')
  if (!token) throw new Error('Please log in again.')
  return { headers: { Authorization: `Bearer ${token}` } }
}
export async function getSavedAvatar() {
  const response = await client.get('/auth/me', config())
  return response.data.user.avatarAppearance
}
export async function saveAvatar(appearance) {
  const response = await client.patch('/auth/me/avatar', appearance, config())
  return response.data.user
}
