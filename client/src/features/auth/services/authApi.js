
import axios from 'axios'

const authApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export async function loginUser(email, password) {
  const response = await authApi.post('/auth/login', {
    email,
    password
  })

  return response.data
}

export function getLoginErrorMessage(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return 'The server is taking too long. Please try again.'
    }

    return 'Unable to connect to the server. Please check your connection.'
  }

  switch (error.response.status) {
    case 400:
      return error.response.data?.message || 'Please check your details.'

    case 401:
      return 'Incorrect email or password. Please try again.'

    case 429:
      return 'Too many login attempts. Please try again later.'

    case 500:
    case 502:
    case 503:
      return 'Something went wrong on our end. Please try again later.'

    default:
      return 'Unable to log in. Please try again.'
  }
}
