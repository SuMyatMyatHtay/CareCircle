import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

export async function registerCaregiver(details) {
  const { data } = await api.post('/auth/register', details)
  if (data?.success !== true || !data.token || !data.user?.id) {
    throw new Error('Unexpected response from server. Please try logging in.')
  }
  return data
}

export function registrationErrorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message
  if (error.code === 'ECONNABORTED') return 'The server is taking too long. Please try again.'
  if (!error.response) return 'Could not connect to CareCircle. Please check your connection.'
  return 'Account creation failed. Please try again.'
}
