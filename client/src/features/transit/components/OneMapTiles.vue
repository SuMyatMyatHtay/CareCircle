<script setup>
// Owner: Chaithra (E), CC-19
// A real OneMap map (Singapore Land Authority's official map tiles). No library needed:
// it lays out the map tiles around the points.
//   Destination pin:  :lat / :lng            (the task's location)
//   Live person dot:  :live-lat / :live-lng  (the companion during a trip, optional)
//   Trail:            :trail="[{ lat, lng }, ...]"  (where they've been, oldest first, optional)
//   Route ahead:      :route="[{ lat, lng }, ...]"  (road route to the destination, green, optional)
// Anything put inside <OneMapTiles>...</OneMapTiles> floats on top (e.g. the ETA card).
// The map zooms out until everything fits. With nothing to show, it shows the green Figma placeholder.
// People can drag to move around, zoom with the +/- buttons, pinch (phone/trackpad) or
// double-click, and "Recentre" brings the map back to the person on the trip.
//   <OneMapTiles :lat="1.3214" :lng="103.8458" label="OneMap · TTSH Eye Centre" :height="220" />
import { ref, computed, watch } from 'vue'
import PersonAvatar from '../../my-tasks/components/PersonAvatar.vue'

const props = defineProps({
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    liveLat: { type: Number, default: null },
    liveLng: { type: Number, default: null },
    liveLabel: { type: String, default: '' }, // e.g. "Jasmine" (also picks their photo)
    liveTime: { type: String, default: '' },  // bubble line 1, e.g. "12:25 AM Tue"
    liveNote: { type: String, default: '' },  // bubble line 2, e.g. "Arrived at TTSH Eye Centre"
    trail: { type: Array, default: () => [] },
    route: { type: Array, default: () => [] },
    label: { type: String, default: '' },
    height: { type: Number, default: 220 },
    fitWidth: { type: Number, default: 480 },
    bottomSpace: { type: Number, default: 0 }, // px covered by a card at the bottom; points stay above it // roughly how wide the card is, for fitting both points
    zoom: { type: Number, default: 17 } // OneMap supports 12 to 19
})

const TILE = 256
// OneMap basemap tiles: /maps/tiles/<style>/{z}/{x}/{y}.png. Falls back to Grey_HD if Default fails.
const TILE_BASE = 'https://www.onemap.gov.sg/maps/tiles'
const STYLES = ['Default', 'Grey_HD']
const MIN_ZOOM = 12 // OneMap has no map pictures below zoom 12
const MAX_ZOOM = 19
const COLS = 7 // enough tiles to fill wide cards
const ROWS = 5
const FIT_MARGIN = 50 // keep both points at least this far from the card's edges

const failedTiles = ref(0)
const styleIndex = ref(0)

const isNum = (v) => Number.isFinite(v)
const dest = computed(() => (isNum(props.lat) && isNum(props.lng) ? { lat: props.lat, lng: props.lng } : null))
const live = computed(() => (isNum(props.liveLat) && isNum(props.liveLng) ? { lat: props.liveLat, lng: props.liveLng } : null))
// The trail, ending at the live dot so the line reaches it
const trailPoints = computed(() => {
    const points = props.trail.filter((p) => isNum(p?.lat) && isNum(p?.lng))
    return live.value ? [...points, live.value] : points
})
// Room above the points for the photo pin (about 55 px) and its bubble (about 55 px)
const topSpace = computed(() => (live.value ? (props.liveTime || props.liveNote ? 110 : 55) : 0))

const routePoints = computed(() => props.route.filter((p) => isNum(p?.lat) && isNum(p?.lng)))
// What the map has to fit: the person, where they're going and the route ahead.
// (The trail behind them isn't included, so an old far-away point can't zoom the map out.)
const allPoints = computed(() => [dest.value, live.value, ...routePoints.value].filter(Boolean))

// Standard web-map maths: a point's position in pixels on the whole world map at zoom z
function toPixels(point, z) {
    const size = TILE * 2 ** z
    const latRad = (point.lat * Math.PI) / 180
    return {
        x: ((point.lng + 180) / 360) * size,
        y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * size
    }
}

// The box around all points, in pixels at zoom z
function bounds(points, z) {
    const px = points.map((p) => toPixels(p, z))
    const xs = px.map((p) => p.x)
    const ys = px.map((p) => p.y)
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

// Closest zoom at which everything fits on the card
const zoomLevel = computed(() => {
    if (allPoints.value.length < 2) return props.zoom
    const fitX = Math.max(40, props.fitWidth / 2 - FIT_MARGIN)
    const fitY = Math.max(40, (props.height - props.bottomSpace - topSpace.value) / 2 - FIT_MARGIN)
    for (let z = props.zoom; z > MIN_ZOOM; z--) {
        const box = bounds(allPoints.value, z)
        if ((box.maxX - box.minX) / 2 <= fitX && (box.maxY - box.minY) / 2 <= fitY) return z
    }
    return MIN_ZOOM
})

// Where the map looks when nobody has moved it: everything in view (see zoomLevel)
const autoView = computed(() => {
    if (!allPoints.value.length) return null
    const z = zoomLevel.value
    // Centre of everything (or the only point)
    const box = bounds(allPoints.value, z)
    const fitX = Math.max(40, props.fitWidth / 2 - FIT_MARGIN)
    const fitY = Math.max(40, (props.height - props.bottomSpace - topSpace.value) / 2 - FIT_MARGIN)
    const fits = (box.maxX - box.minX) / 2 <= fitX && (box.maxY - box.minY) / 2 <= fitY
    // Too far apart to fit even fully zoomed out (e.g. Yishun -> Novena on a phone):
    // keep the person in view and let the destination sit off the edge
    const focus = !fits && live.value ? toPixels(live.value, z) : null
    const cx = focus ? focus.x : (box.minX + box.maxX) / 2
    // Shift so the points sit in the free part of the card: above the bottom card and
    // below the room kept for the photo pin and its bubble
    const cy = (focus ? focus.y : (box.minY + box.maxY) / 2) + (props.bottomSpace - topSpace.value) / 2
    return { z, cx, cy }
})

// Once someone drags or zooms, the map stays where they put it ({ z, cx, cy } in world
// pixels) until they press Recentre. Live updates still move the pins and trail.
const manual = ref(null)
const view = computed(() => manual.value || autoView.value)
const isMoved = computed(() => Boolean(manual.value))

const grid = computed(() => {
    if (!view.value) return null
    const { z, cx, cy } = view.value

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
        live: offset(live.value),
        // SVG polyline points, e.g. "-12,40 -8,31 0,0"
        trail: trailSegments(trailPoints.value).map((part) => toPolyline(part, offset)).filter(Boolean),
        route: toPolyline(routePoints.value, offset)
    }
})

// Split the trail where two points are far apart (a gap, e.g. the page was closed or
// the phone had no GPS), so the map never draws a straight line across a gap
const MAX_STEP_M = 3000 // the server already fills normal gaps along the roads
function metres(a, b) {
    const rad = (d) => (d * Math.PI) / 180
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
    return 2 * 6371000 * Math.asin(Math.sqrt(h))
}
function trailSegments(points) {
    const parts = []
    let current = []
    points.forEach((p, i) => {
        if (i > 0 && metres(points[i - 1], p) > MAX_STEP_M) {
            parts.push(current)
            current = []
        }
        current.push(p)
    })
    parts.push(current)
    return parts
}

function toPolyline(points, offset) {
    if (points.length < 2) return ''
    return points.map((p) => { const o = offset(p); return `${o.x.toFixed(1)},${o.y.toFixed(1)}` }).join(' ')
}

const showMap = computed(() => Boolean(grid.value))
// OneMap's pictures failed (OneMap down, Wi-Fi blocking it, or outside Singapore):
// keep the pins and trail on a plain background instead of hiding everything
const tilesFailed = computed(() => styleIndex.value >= STYLES.length)

// If most tiles of a style fail, try the next style; after the last, show the placeholder
function onTileError() {
    failedTiles.value++
    if (failedTiles.value >= (COLS * ROWS) / 2) {
        failedTiles.value = 0
        styleIndex.value++
    }
}

// ---------- Moving the map ----------
const mapEl = ref(null)
const dragging = ref(false)
const instant = ref(false) // switches off the pins' glide while the map itself moves
let instantTimer = null
function noGlide() {
    instant.value = true
    clearTimeout(instantTimer)
    instantTimer = setTimeout(() => { instant.value = dragging.value }, 80)
}

function takeOver() {
    if (!manual.value && autoView.value) manual.value = { ...autoView.value }
}

// Zoom in (+1) or out (-1), keeping the spot under `anchor` (px from the card's centre) still
function zoomBy(step, anchor = { x: 0, y: 0 }) {
    takeOver()
    const m = manual.value
    if (!m) return
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, m.z + step))
    if (z === m.z) return
    const f = 2 ** (z - m.z)
    noGlide()
    manual.value = { z, cx: (m.cx + anchor.x) * f - anchor.x, cy: (m.cy + anchor.y) * f - anchor.y }
}

function recentre() {
    noGlide()
    manual.value = null
}

function fromCentre(event) {
    const rect = mapEl.value.getBoundingClientRect()
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }
}

// Drag with one finger/mouse, pinch with two fingers
const pointers = new Map()
let pinchStart = 0
function isControl(event) {
    return Boolean(event.target.closest?.('.map-controls, .map-overlay, a, button'))
}
function onPointerDown(event) {
    if (!autoView.value || isControl(event) || (event.pointerType === 'mouse' && event.button !== 0)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try { mapEl.value.setPointerCapture?.(event.pointerId) } catch { /* fine without it */ }
    dragging.value = true
    instant.value = true
    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
    }
}
function onPointerMove(event) {
    const last = pointers.get(event.pointerId)
    if (!last) return
    const now = { x: event.clientX, y: event.clientY }
    pointers.set(event.pointerId, now)
    if (pointers.size === 1) {
        const dx = now.x - last.x
        const dy = now.y - last.y
        if (!dx && !dy) return
        takeOver()
        manual.value = { ...manual.value, cx: manual.value.cx - dx, cy: manual.value.cy - dy }
    } else if (pointers.size === 2 && pinchStart) {
        const [a, b] = [...pointers.values()]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const mid = fromCentre({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 })
        if (distance / pinchStart > 1.5) { zoomBy(1, mid); pinchStart = distance }
        else if (distance / pinchStart < 0.66) { zoomBy(-1, mid); pinchStart = distance }
    }
}
function onPointerUp(event) {
    pointers.delete(event.pointerId)
    if (pointers.size < 2) pinchStart = 0
    if (!pointers.size) {
        dragging.value = false
        noGlide()
    }
}

// Trackpad pinch (and Ctrl + scroll) zooms; plain scrolling still scrolls the page
let wheelSum = 0
function onWheel(event) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    wheelSum += event.deltaY
    if (Math.abs(wheelSum) >= 60) {
        zoomBy(wheelSum < 0 ? 1 : -1, fromCentre(event))
        wheelSum = 0
    }
}
function onDoubleClick(event) {
    if (!autoView.value || isControl(event)) return
    zoomBy(1, fromCentre(event))
}

// A different place (new task): start from the automatic view again
watch(() => [props.lat, props.lng], () => { manual.value = null })

const recentreLabel = computed(() => (props.liveLabel && live.value ? `Recentre on ${props.liveLabel}` : 'Recentre map'))

// The map moved to a different area (new place, or the live dot moved far): try the tiles again.
// OneMap only has tiles for Singapore, so a point outside Singapore shows the placeholder.
watch(() => grid.value?.tiles[0]?.key, () => {
    failedTiles.value = 0
    styleIndex.value = 0
})
</script>

<template>
    <div
        ref="mapEl"
        class="onemap"
        :class="{ interactive: showMap, dragging, instant }"
        :style="{ height: `${height}px` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
        @dblclick="onDoubleClick"
    >
        <template v-if="showMap">
            <div
                v-if="!tilesFailed"
                class="tiles"
                :style="{ transform: `translate(${-grid.shiftX}px, ${-grid.shiftY}px)` }"
                aria-hidden="true"
            >
                <img
                    v-for="tile in grid.tiles"
                    :key="tile.key"
                    :src="tile.src"
                    alt=""
                    draggable="false"
                    :style="{ left: `${tile.left}px`, top: `${tile.top}px` }"
                    @error="onTileError"
                />
            </div>

            <!-- Lines: where they've been (coral) and the road route still to go (green, like Grab) -->
            <svg v-if="grid.trail.length || grid.route" class="trail" aria-hidden="true">
                <template v-for="(part, i) in grid.trail" :key="i">
                    <polyline :points="part" class="trail-edge" />
                    <polyline :points="part" class="trail-line" />
                </template>
                <template v-if="grid.route">
                    <polyline :points="grid.route" class="route-edge" />
                    <polyline :points="grid.route" class="route-line" />
                </template>
            </svg>

            <!-- Destination -->
            <i
                v-if="grid.dest"
                class="bi bi-geo-alt-fill pin"
                :style="{ left: `calc(50% + ${grid.dest.x}px)`, top: `calc(50% + ${grid.dest.y}px)` }"
                aria-hidden="true"
            ></i>

            <!-- The companion, live: photo pin with a little info bubble (like friend-tracker apps) -->
            <div
                v-if="grid.live"
                class="person-pin"
                :style="{ left: `calc(50% + ${grid.live.x}px)`, top: `calc(50% + ${grid.live.y}px)` }"
                :title="liveLabel ? `${liveLabel} is here` : 'Live location'"
            >
                <div v-if="liveTime || liveNote" class="bubble">
                    <span v-if="liveTime"><i class="bi bi-clock" aria-hidden="true"></i> {{ liveTime }}</span>
                    <span v-if="liveNote"><i class="bi bi-geo-alt" aria-hidden="true"></i> {{ liveNote }}</span>
                </div>
                <span class="photo"><PersonAvatar :name="liveLabel" :size="40" tone="peach" /></span>
                <span class="tip" aria-hidden="true"><span class="pulse"></span></span>
            </div>

            <span v-if="label && !grid.live" class="label">{{ label }}</span>

            <!-- Zoom and recentre -->
            <div class="map-controls">
                <button type="button" class="map-btn" aria-label="Zoom in" title="Zoom in" :disabled="view.z >= 19" @click="zoomBy(1)">
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                </button>
                <button type="button" class="map-btn" aria-label="Zoom out" title="Zoom out" :disabled="view.z <= 12" @click="zoomBy(-1)">
                    <i class="bi bi-dash-lg" aria-hidden="true"></i>
                </button>
                <button
                    type="button"
                    class="map-btn recentre"
                    :class="{ highlight: isMoved }"
                    :aria-label="recentreLabel"
                    :title="recentreLabel"
                    @click="recentre"
                >
                    <i class="bi bi-crosshair" aria-hidden="true"></i>
                </button>
            </div>

            <div class="map-overlay"><slot></slot></div>
            <span v-if="tilesFailed" class="credit">Map pictures unavailable right now</span>
            <span v-else class="credit">New OneMap | Map data © contributors, Singapore Land Authority</span>
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
    background: var(--theme-soft, #e8f5e9);
    /* faint grid, seen only when OneMap's pictures can't load */
    background-image:
        linear-gradient(rgba(47, 122, 63, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(47, 122, 63, 0.08) 1px, transparent 1px);
    background-size: 32px 32px;
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
    pointer-events: none;
    -webkit-user-drag: none;
    position: absolute;
    width: 256px;
    height: 256px;
    max-width: none;
    user-select: none;
}

.trail {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1px;
    height: 1px;
    overflow: visible;
    pointer-events: none;
}

.trail polyline {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.trail-edge {
    stroke: white;
    stroke-width: 8;
}

.trail-line {
    stroke: #e46f5c;
    stroke-width: 4.5;
    opacity: 0.85;
}

.route-edge {
    stroke: white;
    stroke-width: 9;
}

.route-line {
    stroke: #2f9e44;
    stroke-width: 5.5;
}

.pin {
    position: absolute;
    transform: translate(-50%, -100%);
    font-size: 34px;
    line-height: 1;
    color: var(--theme-green, #2f7a3f);
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
}

/* Coral dot for the person on the trip; glides when the position changes */
.person-pin {
    position: absolute;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* the tip of the pin sits exactly on the point */
    transform: translate(-50%, -100%);
    transition: left 1s ease, top 1s ease;
}

.person-pin .photo {
    display: block;
    padding: 3px;
    border-radius: 50%;
    background: #f28b7a;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.person-pin .tip {
    position: relative;
    width: 0;
    height: 0;
    margin-top: -2px;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 11px solid #f28b7a;
}

/* pulsing ring where the tip touches the map */
.person-pin .tip .pulse {
    inset: auto;
    top: -2px;
    left: -12px;
    width: 24px;
    height: 24px;
    margin-top: -12px;
    z-index: -1;
}

.bubble {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--theme-panel, white);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
    font-size: 13px;
    font-weight: 600;
    color: var(--theme-text, #2e2e2e);
    white-space: nowrap;
}

.bubble .bi {
    color: var(--theme-muted, #6b7280);
}

.live-dot {
    position: absolute;
    width: 18px;
    height: 18px;
    transform: translate(-50%, -50%);
    border: 3px solid var(--theme-border, white);
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
    background: var(--theme-panel, white);
    font-size: 12px;
    font-weight: 700;
    color: var(--theme-text, #2e2e2e);
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

@keyframes pulse {
    from { transform: scale(0.6); opacity: 1; }
    to { transform: scale(1.6); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
    .pulse { animation: none; }
    .live-dot,
    .person-pin { transition: none; }
}

.onemap.interactive .pin,
.onemap.interactive .person-pin,
.onemap.interactive .live-dot,
.onemap.interactive .label {
    pointer-events: none;
}

.onemap.interactive {
    cursor: grab;
    touch-action: none; /* the map handles dragging and pinching itself */
    user-select: none;
}

.onemap.dragging {
    cursor: grabbing;
}

.onemap.instant .person-pin,
.onemap.instant .live-dot {
    transition: none;
}

.map-controls {
    position: absolute;
    right: 10px;
    top: 50%;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transform: translateY(-50%);
}

.map-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 10px;
    background: var(--theme-panel, white);
    color: var(--theme-text, #2e2e2e);
    font-size: 16px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    cursor: pointer;
}

.map-btn:hover:not(:disabled) {
    background: var(--theme-soft, #e8f5e9);
}

.map-btn:disabled {
    opacity: 0.45;
    cursor: default;
}

.map-btn.recentre.highlight {
    border-color: var(--theme-green, #2f7a3f);
    color: var(--theme-green, #2f7a3f);
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
    background: var(--theme-soft, #e8f5e9);
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    color: var(--theme-green, #2f7a3f);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.credit {
    position: absolute;
    right: 0;
    bottom: 0;
    padding: 2px 6px;
    background: var(--theme-translucent-panel, rgba(255, 255, 255, 0.85));
    font-size: 10px;
    color: var(--theme-muted, #4b5563);
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
    color: var(--theme-green, #2f7a3f);
}

.map-placeholder .bi {
    font-size: 30px;
}
</style>
