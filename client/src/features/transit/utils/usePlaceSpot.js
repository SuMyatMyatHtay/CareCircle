// Owner: Chaithra (E)
// Where to pin a place on the map. Places picked from OneMap already have lat/lng; a place
// typed by hand (e.g. "FairPrice, Junction 8, S579837") is looked up once with our OneMap
// search, postal code first. Returns null until a spot is known (the map shows its placeholder).
//   const spot = usePlaceSpot(() => task.value?.location)   // -> { lat, lng } | null
import { ref, computed, watch } from 'vue'
import { searchClinics } from '../services/transitApi.js'

const hasCoords = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)

export function usePlaceSpot(getPlace) {
    const found = ref(null)
    let lastQuery = ''

    // The trip page reloads the task every few seconds (a new object each time). Only look
    // the place up again when the place itself changes, and keep the pin meanwhile: a pin
    // that blinked away made the map forget where you had zoomed to.
    watch(getPlace, async (place) => {
        if (!place || hasCoords(place)) {
            found.value = null
            lastQuery = ''
            return
        }
        const query = place.postal || place.name || place.address || ''
        if (query === lastQuery) return
        lastQuery = query
        found.value = null
        if (!query) return
        try {
            const { clinics, otherPlaces } = await searchClinics(query)
            const hit = [...clinics, ...otherPlaces].find(hasCoords)
            if (hit && lastQuery === query) found.value = { lat: hit.lat, lng: hit.lng }
        } catch {
            lastQuery = '' // try again on the next refresh
        }
    }, { immediate: true })

    return computed(() => {
        const place = getPlace()
        return hasCoords(place) ? { lat: place.lat, lng: place.lng } : found.value
    })
}
