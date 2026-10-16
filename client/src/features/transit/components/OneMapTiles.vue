<script setup>
// Owner: Chaithra (E), CC-19
// A real OneMap map (Singapore Land Authority's official map tiles). No library needed:
// it lays out the map tiles around the points.
//   Destination pin:  :lat / :lng            (the task's location)
//   Live person dot:  :live-lat / :live-lng  (the companion during a trip, optional)
// With both, the map zooms out until both fit. With neither, it shows the green Figma placeholder.
//   <OneMapTiles :lat="1.3214" :lng="103.8458" label="OneMap · TTSH Eye Centre" :height="220" />
import { ref, computed, watch } from 'vue'

const props = defineProps({
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    liveLat: { type: Number, default: null },
    liveLng: { type: Number, default: null },
    liveLabel: { type: String, default: '' }, // e.g. "Jasmine"
    label: { type: String, default: '' },
    height: { type: Number, default: 220 },
    fitWidth: { type: Number, default: 480 }, // roughly how wide the card is, for fitting both points
    zoom: { type: Number, default: 17 } // OneMap supports 11 to 19
})

const TILE = 256
// OneMap basemap tiles: /maps/tiles/<style>/{z}/{x}/{y}.png. Falls back to Grey_HD if Default fails.
const TILE_BASE = 'https://www.onemap.gov.sg/maps/tiles'
const STYLES = ['Default', 'Grey_HD']
const MIN_ZOOM = 11
const COLS = 7 // enough tiles to fill wide cards
const ROWS = 5
const FIT_MARGIN = 50 // keep both points at least this far from the card's edges

const failedTiles = ref(0)
const styleIndex = ref(0)

const isNum = (v) => Number.isFinite(v)
const dest = computed(() => (isNum(props.lat) && isNum(props.lng) ? { lat: props.lat, lng: props.lng } : null))
const live = computed(() => (isNum(props.liveLat) && isNum(props.liveLng) ? { lat: props.liveLat, lng: props.liveLng } : null))

// Standard web-map maths: a point's position in pixels on the whole world map at zoom z
function toPixels(point, z) {
    const size = TILE * 2 ** z
    const latRad = (point.lat * Math.PI) / 180
    return {
        x: ((point.lng + 180) / 360) * size,
        y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * size
    }
}

// Closest zoom at which both points fit on the card
const zoomLevel = computed(() => {
    if (!dest.value || !live.value) return props.zoom
    const fitX = Math.max(40, props.fitWidth / 2 - FIT_MARGIN)
    const fitY = Math.max(40, props.height / 2 - FIT_MARGIN)
    for (let z = props.zoom; z > MIN_ZOOM; z--) {
        const a = toPixels(dest.value, z)
        const b = toPixels(live.value, z)
        if (Math.abs(a.x - b.x) / 2 <= fitX && Math.abs(a.y - b.y) / 2 <= fitY) return z
    }
    return MIN_ZOOM
})

const grid = computed(() => {
    const points = [dest.value, live.value].filter(Boolean)
    if (!points.length) return null
    const z = zoomLevel.value
    const px = points.map((p) => toPixels(p, z))
    // Centre between the points (or on the only point)
    const cx = px.reduce((sum, p) => sum + p.x, 0) / px.length
    const cy = px.reduce((sum, p) => sum + p.y, 0) / px.length

    const firstX = Math.floor(cx / TILE) - Math.floor(COLS / 2)
    const firstY = Math.floor(cy / TILE) - Math.floor(ROWS / 2)
    const tiles = []
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            tiles.push({
                key: `${z}-${firstX + col}-${firstY + row}`,
                src: `${TILE_BASE}/${STYLES[styleIndex.value]}/${z}/${firstX + col}/${firstY + row}.png`,
                left: col * TILE,
                top: row * TILE
            })
        }
    }
    // Offsets from the card's centre, in pixels
    const offset = (p) => (p ? { x: toPixels(p, z).x - cx, y: toPixels(p, z).y - cy } : null)
    return {
        tiles,
        shiftX: cx - firstX * TILE,
        shiftY: cy - firstY * TILE,
        dest: offset(dest.value),
        live: offset(live.value)
    }
})

const showMap = computed(() => grid.value && styleIndex.value < STYLES.length)

// If most tiles of a style fail, try the next style; after the last, show the placeholder
function onTileError() {
    failedTiles.value++
    if (failedTiles.value >= (COLS * ROWS) / 2) {
        failedTiles.value = 0
        styleIndex.value++
    }
}

// New place: try the main style again. (A moving live dot doesn't reset anything.)
watch(() => [props.lat, props.lng], () => {
    failedTiles.value = 0
    styleIndex.value = 0
})
</script>

<template>
    <div class="onemap" :style="{ height: `${height}px` }">
        <template v-if="showMap">
            <div
                class="tiles"
                :style="{ transform: `translate(${-grid.shiftX}px, ${-grid.shiftY}px)` }"
                aria-hidden="true"
            >
                <img
                    v-for="tile in grid.tiles"
                    :key="tile.key"
                    :src="tile.src"
                    alt=""
                    :style="{ left: `${tile.left}px`, top: `${tile.top}px` }"
                    @error="onTileError"
                />
            </div>

            <!-- Destination -->
            <i
                v-if="grid.dest"
                class="bi bi-geo-alt-fill pin"
                :style="{ left: `calc(50% + ${grid.dest.x}px)`, top: `calc(50% + ${grid.dest.y}px)` }"
                aria-hidden="true"
            ></i>

            <!-- The companion, live -->
            <span
                v-if="grid.live"
                class="live-dot"
                :style="{ left: `calc(50% + ${grid.live.x}px)`, top: `calc(50% + ${grid.live.y}px)` }"
                :title="liveLabel ? `${liveLabel} is here` : 'Live location'"
            >
                <span class="pulse" aria-hidden="true"></span>
                <span v-if="liveLabel" class="live-name">{{ liveLabel }}</span>
            </span>

            <span v-if="label" class="label">{{ label }}</span>
            <span class="credit">New OneMap | Map data © contributors, Singapore Land Authority</span>
        </template>

        <!-- Figma placeholder look, used when there's no location -->
        <div v-else class="map-placeholder">
            <i class="bi bi-geo-alt" aria-hidden="true"></i>
            <span>{{ label || 'No location on this task' }}</span>
        </div>
    </div>
</template>

<style scoped>
.onemap {
    position: relative;
    overflow: hidden;
    width: 100%;
    border-radius: 12px;
    background: #e8f5e9;
}

/* The tile block is placed so the centre point sits exactly in the middle of the card */
.tiles {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
}

.tiles img {
    position: absolute;
    width: 256px;
    height: 256px;
    max-width: none;
    user-select: none;
}

.pin {
    position: absolute;
    transform: translate(-50%, -100%);
    font-size: 34px;
    line-height: 1;
    color: #2f7a3f;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
}

/* Coral dot for the person on the trip; glides when the position changes */
.live-dot {
    position: absolute;
    width: 18px;
    height: 18px;
    transform: translate(-50%, -50%);
    border: 3px solid white;
    border-radius: 50%;
    background: #f28b7a;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    transition: left 1s ease, top 1s ease;
}

.pulse {
    position: absolute;
    inset: -9px;
    border-radius: 50%;
    background: rgba(242, 139, 122, 0.35);
    animation: pulse 2s ease-out infinite;
}

.live-name {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    transform: translateX(-50%);
    padding: 2px 8px;
    border-radius: 999px;
    background: white;
    font-size: 12px;
    font-weight: 700;
    color: #2e2e2e;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

@keyframes pulse {
    from { transform: scale(0.6); opacity: 1; }
    to { transform: scale(1.6); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
    .pulse { animation: none; }
    .live-dot { transition: none; }
}

.label {
    position: absolute;
    left: 12px;
    top: 12px;
    max-width: calc(100% - 140px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 6px 10px;
    border-radius: 999px;
    background: #e8f5e9;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    color: #2f7a3f;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.credit {
    position: absolute;
    right: 0;
    bottom: 0;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.85);
    font-size: 10px;
    color: #4b5563;
}

.map-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    color: #2f7a3f;
}

.map-placeholder .bi {
    font-size: 30px;
}
</style>
