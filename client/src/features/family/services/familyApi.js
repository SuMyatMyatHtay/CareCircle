
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

// Create a family
export async function createFamily(name) {
    const token = sessionStorage.getItem('token')

    if (!token) {
        throw new Error('Please log in first.')
    }

    const response = await axios.post(
        `${API_URL}/families`,
        { name },
        {
        headers: {
            Authorization: `Bearer ${token}`
        }
        }
    )

    return response.data
}

// Get all families belonging to the user
export async function getMyFamilies() {
    const token = sessionStorage.getItem('token')

    if (!token) {
        throw new Error('Please log in first.')
    }

    const response = await axios.get(
        `${API_URL}/families/mine`,
        {
        headers: {
            Authorization: `Bearer ${token}`
        }
        }
    )

    return response.data.families
}

// Return friendly error messages
export function getFamilyErrorMessage(error) {
    if (error.response?.status === 401) {
        return 'Your session has expired. Please log in again.'
    }

    return (
        error.response?.data?.message ||
        error.message ||
        'Something went wrong. Please try again.'
    )
}


export async function joinFamily(inviteCode) {
    const token = sessionStorage.getItem('token')

    if (!token) {
        throw new Error('Please log in first.')
    }

    const response = await axios.post(
        `${API_URL}/families/join`,
        { inviteCode },
        {
        headers: {
            Authorization: `Bearer ${token}`
        }
        }
    )

    return response.data
}
