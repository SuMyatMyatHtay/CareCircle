<script setup>
// Owner: Chaithra (E)
// Round avatar like Figma's cc/Avatar. Shows the illustrated avatar from
// client/public/avatars/people/<name>.png when it exists, otherwise initials.
//   <PersonAvatar name="Grandpa" :size="44" />
import { ref, computed, watch } from 'vue'
import { initials } from '../utils/formatters.js'

const props = defineProps({
    name: { type: String, default: '' },
    size: { type: Number, default: 40 },
    tone: { type: String, default: 'green' } // green | peach | yellow
})

// Figma avatars, exported as PNGs into client/public/avatars/people/
const IMAGES = {
    grandpa: 'grandpa', grandma: 'grandma', emma: 'baby-emma',
    jasmine: 'jasmine', alex: 'alex', may: 'aunt-may', mia: 'mia'
}

const src = computed(() => {
    const words = props.name.toLowerCase().split(/\s+/)
    const key = Object.keys(IMAGES).find((k) => words.includes(k))
    return key ? `/avatars/people/${IMAGES[key]}.png` : ''
})

const failed = ref(false)
watch(src, () => { failed.value = false })
</script>

<template>
    <span
        class="person-avatar"
        :class="`tone-${tone}`"
        :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.34)}px` }"
        aria-hidden="true"
    >
        <img v-if="src && !failed" :src="src" alt="" @error="failed = true" />
        <template v-else-if="name">{{ initials(name) }}</template>
        <i v-else class="bi bi-house-heart"></i>
    </span>
</template>

<style scoped>
.person-avatar {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 2px solid white;
    border-radius: 50%;
    font-weight: 700;
}

.tone-green {
    background: #e8f5e9;
    color: #2f7a3f;
}

.tone-peach {
    background: #ffe9e4;
    color: #b5583f;
}

.tone-yellow {
    background: #fff6e0;
    color: #7a4b00;
    font-weight: 900;
}

img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
</style>
