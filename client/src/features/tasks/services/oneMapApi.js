// Owner: Marcus (D)
// Place search through OneMap (Singapore Land Authority). Called straight from the
// browser: the search endpoint needs no token and allows any origin.
//   const places = await searchPlaces('tan tock seng', { signal })
const SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'
const MAX_RESULTS = 5

// OneMap returns everything in capitals: "TAN TOCK SENG HOSPITAL" -> "Tan Tock Seng Hospital"
function titleCase(text = '') {
    return text.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
}

function toPlace(result) {
    const postal = /^\d{6}$/.test(result.POSTAL) ? result.POSTAL : ''
    const name = result.BUILDING && result.BUILDING !== 'NIL' ? result.BUILDING : result.SEARCHVAL
    // Block + road reads best ("21 Ang Mo Kio Central 2"). ADDRESS repeats the building
    // name and ends with "SINGAPORE 123456", so it's only the fallback.
    const street = [result.BLK_NO, result.ROAD_NAME].filter((part) => part && part !== 'NIL').join(' ')
    const address = street || (result.ADDRESS || '').replace(/\s*SINGAPORE\s+\d{6}$/i, '')

    return {
        name: titleCase(name),
        address: titleCase(address),
        postal,
        lat: Number(result.LATITUDE),
        lng: Number(result.LONGITUDE)
    }
}

// Up to 5 places as { name, address, postal, lat, lng }, the same shape as a task's location
export async function searchPlaces(query, { signal } = {}) {
    const searchVal = query.trim()
    if (!searchVal) return []

    const params = new URLSearchParams({ searchVal, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: '1' })
    const response = await fetch(`${SEARCH_URL}?${params}`, { signal })

    if (!response.ok) {
        throw new Error('Place search is unavailable right now.')
    }

    const data = await response.json()
    return (data.results || []).slice(0, MAX_RESULTS).map(toPlace)
}
