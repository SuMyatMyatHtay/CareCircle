// Owner: Marcus (D)
// Handler for GET /api/families/:familyId/search.
// Checks the query string, then hands over to service.js.
//
// requireAuth + requireFamilyMember run first, so req.family is always set.
// The family always comes from req.family, never from the query string.
import mongoose from 'mongoose'
import { runSearch, SEARCH_TYPES, SEARCH_WHEN, SEARCH_STATUS, SEARCH_SORT } from './service.js'

const MIN_QUERY = 2
const MAX_QUERY = 80
const DEFAULT_LIMIT = 5 // the dropdown under the search bar
const MAX_LIMIT = 50 // the full results page

function pick(value, allowed, fallback, name, errors) {
    if (value === undefined || value === '') return fallback
    if (typeof value === 'string' && allowed.includes(value)) return value
    errors.push(`${name} must be one of: ${allowed.join(', ')}`)
    return fallback
}

// Returns { params } or { errors }
export function parseSearchQuery(query) {
    const errors = []

    const q = typeof query.q === 'string' ? query.q.trim() : ''
    if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
        errors.push(`Search must be ${MIN_QUERY} to ${MAX_QUERY} characters`)
    }

    const type = pick(query.type, SEARCH_TYPES, 'all', 'type', errors)
    const when = pick(query.when, SEARCH_WHEN, 'any', 'when', errors)
    const status = pick(query.status, SEARCH_STATUS, 'any', 'status', errors)
    const sort = pick(query.sort, SEARCH_SORT, 'best', 'sort', errors)

    let recipient = null
    if (query.recipient !== undefined && query.recipient !== '') {
        if (typeof query.recipient === 'string' && mongoose.isValidObjectId(query.recipient)) {
            recipient = query.recipient
        } else {
            errors.push('recipient must be a valid id')
        }
    }

    let limit = DEFAULT_LIMIT
    if (query.limit !== undefined && query.limit !== '') {
        limit = Number(query.limit)
        if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
            errors.push(`limit must be a whole number from 1 to ${MAX_LIMIT}`)
        }
    }

    if (errors.length) return { errors }
    return { params: { q, type, when, status, sort, recipient, limit } }
}

export async function searchFamily(req, res, next) {
    try {
        const { params, errors } = parseSearchQuery(req.query)
        if (errors) {
            return res.status(400).json({ error: errors[0], errors })
        }

        const result = await runSearch(req.family, params)
        return res.json(result)
    } catch (error) {
        return next(error)
    }
}
