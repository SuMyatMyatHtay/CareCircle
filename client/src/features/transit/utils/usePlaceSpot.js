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

    watch(getPlace, async (place) => {
        found.value = null
        if (!place || hasCoords(place)) return
        const query = place.postal || place.name || place.address
        if (!query) return
        try {
            const { clinics, otherPlaces } = await searchClinics(query)
            const hit = [...clinics, ...otherPlaces].find(hasCoords)
            if (hit && getPlace() === place) found.value = { lat: hit.lat, lng: hit.lng }
        } catch {
            // No map then; the address line still shows
        }
    }, { immediate: true })

    return computed(() => {
        const place = getPlace()
        return hasCoords(place) ? { lat: place.lat, lng: place.lng } : found.value
    })
}
