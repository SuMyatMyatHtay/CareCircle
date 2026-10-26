import { http } from '../../../services/http.js'
import { authConfig } from '../../family/services/dashboardApi.js'

export async function getNotifySettings(familyId) {
  const { data } = await http.get(`/families/${familyId}/notify-settings`, authConfig())
  if (!Array.isArray(data.notifyOn) || !data.telegram) throw new Error('Invalid notification settings from server.')
  return data // { notifyOn, telegram: { linked, linkedAt, linkedBy }, botUsername }
}
export async function saveNotifyEvents(familyId, notifyOn) {
  const { data } = await http.patch(`/families/${familyId}/notify-settings`, { notifyOn }, authConfig())
  return data.notifyOn
}
export async function sendTestMessage(familyId) {
  await http.post(`/families/${familyId}/notify-settings/test`, {}, authConfig())
}
export async function unlinkTelegram(familyId) {
  await http.delete(`/families/${familyId}/notify-settings/telegram`, authConfig())
}
export async function getNotifications(familyId, limit = 8) {
  const { data } = await http.get(`/families/${familyId}/notifications`, authConfig({ params: { limit } }))
  if (!Array.isArray(data.notifications)) throw new Error('Invalid notification data from server.')
  return data.notifications
}
