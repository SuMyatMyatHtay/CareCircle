// Owner: Chaithra (E), CC-19
// GET /api/integrations/clinics?q=<search text>
// Searches OneMap (Singapore Land Authority) and returns places in the same
// shape as a task's location, so the result can be saved on a task directly.
const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'

// OneMap sends 'NIL' when there's no value, and numbers as strings
function clean(value) {
    return value && value !== 'NIL' ? String(value).trim() : ''
}

function toLocation(result) {
    const postal = clean(result.POSTAL)
    return {
        name: clean(result.BUILDING) || clean(result.SEARCHVAL),
        address: clean(result.ADDRESS),
        postal: /^\d{6}$/.test(postal) ? postal : '',
        lat: Number.parseFloat(result.LATITUDE),
        lng: Number.parseFloat(result.LONGITUDE)
    }
}

export async function searchClinics(req, res) {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (q.length < 2) {
        return res.status(400).json({ error: 'Validation failed', errors: ['Type at least 2 characters'] })
    }

    const url = new URL(ONEMAP_SEARCH_URL)
    url.searchParams.set('searchVal', q.slice(0, 100))
    url.searchParams.set('returnGeom', 'Y')
    url.searchParams.set('getAddrDetails', 'Y')
    url.searchParams.set('pageNum', '1')

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!response.ok) throw new Error(`OneMap responded ${response.status}`)

        const data = await response.json()
        const clinics = (data.results || [])
            .map(toLocation)
            .filter((place) => place.name && Number.isFinite(place.lat) && Number.isFinite(place.lng))
            .slice(0, 10)

        return res.json({ clinics })
    } catch (error) {
        console.error('OneMap search failed:', error.message)
        return res.status(502).json({ error: 'Location search is unavailable right now. Please try again.' })
    }
}
