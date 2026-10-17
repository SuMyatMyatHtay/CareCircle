// Owner: Chaithra (E), CC-19
// GET /api/integrations/clinics?q=<search text>
// Searches OneMap (Singapore Land Authority) and returns places in the same
// shape as a task's location, so the result can be saved on a task directly.
const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'

// OneMap's search covers every building and street in Singapore, not only clinics.
// Results whose name or address looks medical go in `clinics`; the rest go in
// `otherPlaces`, which the UI only shows when no clinic matched (e.g. a home address).
const MEDICAL_WORDS = /\b(clinic|clinics|polyclinic|hospital|medical|medicine|medic|health|healthcare|dental|dentist|surgery|surgical|specialist|eye|heart|cancer|kidney|dialysis|rehab|rehabilitation|hospice|nursing|physio|physiotherapy|tcm|pharmacy|chas|family practice|gp)\b/i
const PAGES = 2 // OneMap returns 10 results per page

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

function isMedical(place) {
    return MEDICAL_WORDS.test(`${place.name} ${place.address}`)
}

async function searchPage(q, pageNum) {
    const url = new URL(ONEMAP_SEARCH_URL)
    url.searchParams.set('searchVal', q.slice(0, 100))
    url.searchParams.set('returnGeom', 'Y')
    url.searchParams.set('getAddrDetails', 'Y')
    url.searchParams.set('pageNum', String(pageNum))

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`OneMap responded ${response.status}`)
    const data = await response.json()
    return { results: data.results || [], totalPages: Number(data.totalNumPages) || 1 }
}

export async function searchClinics(req, res) {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (q.length < 2) {
        return res.status(400).json({ error: 'Validation failed', errors: ['Type at least 2 characters'] })
    }

    try {
        const first = await searchPage(q, 1)
        let results = first.results
        if (first.totalPages > 1 && PAGES > 1) {
            // A second page gives the clinic filter more to work with; skip it if it fails
            const second = await searchPage(q, 2).catch(() => ({ results: [] }))
            results = results.concat(second.results)
        }

        const seen = new Set()
        const places = results
            .map(toLocation)
            .filter((place) => place.name && Number.isFinite(place.lat) && Number.isFinite(place.lng))
            .filter((place) => {
                const key = `${place.name}|${place.postal}`
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })

        const clinics = places.filter(isMedical).slice(0, 10)
        const otherPlaces = places.filter((place) => !isMedical(place)).slice(0, 5)

        return res.json({ clinics, otherPlaces })
    } catch (error) {
        console.error('OneMap search failed:', error.message)
        return res.status(502).json({ error: 'Location search is unavailable right now. Please try again.' })
    }
}
