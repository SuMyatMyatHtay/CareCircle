// Owner: Chaithra (E)
// The road route from the person on the trip to where they're going, for the green
// "route ahead" line on the live map. Uses OSRM (free routing on OpenStreetMap data, no key).
// It is looked up again only when the person has moved about 150 m or the place changes,
// so a live update every few seconds doesn't re-route (or redraw) the whole line.
//   const route = useRouteAhead(() => liveSpot.value, () => destination.value)  // -> [{ lat, lng }]
import { ref, watch } from 'vue'

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'
const MOVE_M = 150   // look up again after moving this far
const ARRIVED_M = 80 // closer than this: no route to draw

const hasCoords = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)

function metres(a, b) {
    const rad = (d) => (d * Math.PI) / 180
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
    return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export function useRouteAhead(getFrom, getTo) {
    const route = ref([])
    let lastFrom = null
    let lastTo = null
    let busy = false

    watch(() => [getFrom(), getTo()], async ([from, to]) => {
        if (!hasCoords(from) || !hasCoords(to) || metres(from, to) < ARRIVED_M) {
            route.value = []
            lastFrom = null
            return
        }
        const samePlace = lastTo && metres(lastTo, to) < 5
        if (samePlace && lastFrom && metres(lastFrom, from) < MOVE_M) return
        if (busy) return
        busy = true
        try {
            const url = `${OSRM_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=geojson`
            const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
            const data = await response.json()
            const coords = data.routes?.[0]?.geometry?.coordinates || []
            if (coords.length > 1) {
                // OSRM starts and ends the route on the nearest road, so join it to the
                // person and to the place pin; the line then touches both
                route.value = [
                    { lat: from.lat, lng: from.lng },
                    ...coords.map(([lng, lat]) => ({ lat, lng })),
                    { lat: to.lat, lng: to.lng }
                ]
                lastFrom = { lat: from.lat, lng: from.lng }
                lastTo = { lat: to.lat, lng: to.lng }
            }
        } catch {
            // Routing service busy or offline: the map still shows the trail and both pins
        } finally {
            busy = false
        }
    }, { immediate: true })

    return route
}
