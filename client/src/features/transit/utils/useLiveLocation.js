// Owner: Chaithra (E)
// Shares the companion's position while a trip is active.
//   const live = useLiveLocation({ enabled, send })
//   live.position  -> { lat, lng, at } | null   (this device's latest fix)
//   live.status    -> 'off' | 'waiting' | 'sharing' | 'denied' | 'unsupported'
// The browser asks "Allow location?" the first time. Positions are sent to the server
// at most every SEND_MS; the map on everyone else's screen picks them up on its next poll.
import { ref, watch, onUnmounted } from 'vue'

const SEND_MS = 20 * 1000

export function useLiveLocation({ enabled, send }) {
    const position = ref(null)
    const status = ref('off')
    let watchId = null
    let lastSent = 0

    function stop() {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId)
        watchId = null
        if (status.value !== 'denied' && status.value !== 'unsupported') status.value = 'off'
    }

    function onFix(fix) {
        const point = { lat: fix.coords.latitude, lng: fix.coords.longitude, at: new Date().toISOString() }
        position.value = point
        status.value = 'sharing'
        if (Date.now() - lastSent >= SEND_MS) {
            lastSent = Date.now()
            // A failed send is fine: the next fix tries again
            send({ lat: point.lat, lng: point.lng }).catch(() => { lastSent = 0 })
        }
    }

    function onError(error) {
        // 1 = the user said no. 2/3 = no signal or timed out: keep watching
        if (error.code === 1) {
            status.value = 'denied'
            stop()
        }
    }

    function start() {
        if (!('geolocation' in navigator) || !window.isSecureContext) {
            status.value = 'unsupported'
            return
        }
        if (watchId !== null) return
        status.value = 'waiting'
        lastSent = 0
        watchId = navigator.geolocation.watchPosition(onFix, onError, {
            enableHighAccuracy: true,
            maximumAge: 10 * 1000,
            timeout: 30 * 1000
        })
    }

    watch(enabled, (on) => (on ? start() : stop()), { immediate: true })
    onUnmounted(stop)

    return { position, status }
}
