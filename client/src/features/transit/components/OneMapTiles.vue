<script setup>
// Owner: Chaithra (E), CC-19
// A real OneMap map (Singapore Land Authority's official map tiles) centred on a place,
// with a pin. No library needed: it lays out the map tiles around the point.
// If there are no coordinates, or the tiles can't load, it shows the green Figma placeholder.
//   <OneMapTiles :lat="1.3214" :lng="103.8458" label="OneMap · TTSH Eye Centre" :height="220" />
import { ref, computed, watch } from 'vue'

const props = defineProps({
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    label: { type: String, default: '' },
    height: { type: Number, default: 220 },
    zoom: { type: Number, default: 17 } // OneMap supports 11 to 19
})

const TILE = 256
// OneMap basemap tiles: /maps/tiles/<style>/{z}/{x}/{y}.png. Falls back to Grey_HD if Default fails.
const TILE_BASE = 'https://www.onemap.gov.sg/maps/tiles'
const STYLES = ['Default', 'Grey_HD']
const COLS = 7 // enough tiles to fill wide cards
const ROWS = 5

const failedTiles = ref(0)
const styleIndex = ref(0)
const hasPoint = computed(() => Number.isFinite(props.lat) && Number.isFinite(props.lng))

// Standard web-map maths: which tile (and where inside it) the point falls in
const grid = computed(() => {
    if (!hasPoint.value) return null
    const n = 2 ** props.zoom
    const x = ((props.lng + 180) / 360) * n
    const latRad = (props.lat * Math.PI) / 180
    const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n

    const firstX = Math.floor(x) - Math.floor(COLS / 2)
    const firstY = Math.floor(y) - Math.floor(ROWS / 2)
    const tiles = []
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            tiles.push({
                key: `${firstX + col}-${firstY + row}`,
                src: `${TILE_BASE}/${STYLES[styleIndex.value]}/${props.zoom}/${firstX + col}/${firstY + row}.png`,
                left: col * TILE,
                top: row * TILE
            })
        }
    }
    // Where the point is inside the tile block, in pixels
    return { tiles, pointX: (x - firstX) * TILE, pointY: (y - firstY) * TILE }
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
                :style="{ transform: `translate(${-grid.pointX}px, ${-grid.pointY}px)` }"
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
            <i class="bi bi-geo-alt-fill pin" aria-hidden="true"></i>
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

/* The tile block is placed so the point sits exactly in the centre */
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
    top: 50%;
    left: 50%;
    transform: translate(-50%, -100%);
    font-size: 34px;
    color: #2f7a3f;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
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
