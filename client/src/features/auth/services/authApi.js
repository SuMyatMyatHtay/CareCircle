
import axios from 'axios'

const authApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
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

export async function verifySession() {
  const token = sessionStorage.getItem('token')

  if (!token) {
    return { status: 'invalid' }
  }

  try {
    const response = await authApi.get('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (response.data.success === true && response.data.user) {
      // Refresh locally stored user details
      sessionStorage.setItem(
        'user',
        JSON.stringify(response.data.user)
      )

      return { status: 'valid' }
    }

    return { status: 'unavailable' }

  } catch (error) {
    // Token expired, revoked, malformed or user deleted
    if (error.response?.status === 401 ||
        error.response?.status === 404) {
      clearUserSession()
      return { status: 'invalid' }
    }

    // Network/server problems are not authentication failures
    return { status: 'unavailable' }
  }
}


export async function logoutUser() {
  const token = sessionStorage.getItem('token')

  if (!token) {
    return
  }

  await authApi.post(
    '/auth/logout',
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )
}

export function clearUserSession() {
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')
  sessionStorage.removeItem('activeFamilyId')
}


export async function getMyProfile() {
  const token = sessionStorage.getItem('token')

  const response = await authApi.get('/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  return response.data.user
}

export async function updateMyProfile(profile) {
  const token = sessionStorage.getItem('token')

  const response = await authApi.patch(
    '/auth/me',
    profile,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )

  return response.data.user
}
