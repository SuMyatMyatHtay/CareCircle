<script setup>
// Owner: Chaithra (E), CC-19. "Location" block of Figma "05 · Task detail".
// OneMap map of the task's place, then the address line.
//   <TaskLocationCard :location="task.location" />
import { computed } from 'vue'
import OneMapTiles from './OneMapTiles.vue'

const props = defineProps({
    location: { type: Object, default: null }
})

const name = computed(() => props.location?.name || props.location?.address || '')
const addressLine = computed(() => {
    const loc = props.location
    if (!loc) return ''
    const street = loc.name && loc.address ? `${loc.name} · ${loc.address}` : loc.name || loc.address || ''
    return loc.postal ? `${street}, S${loc.postal}` : street
})
</script>

<template>
    <section class="location" aria-label="Location">
        <OneMapTiles
            :lat="location?.lat ?? null"
            :lng="location?.lng ?? null"
            :label="name ? `OneMap · ${name}` : ''"
            :height="220"
        />
        <p v-if="addressLine" class="address">
            <i class="bi bi-geo-alt" aria-hidden="true"></i>
            {{ addressLine }}
        </p>
    </section>
</template>

<style scoped>
.location {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
}

.address {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    color: #2e2e2e;
}

.address .bi {
    font-size: 17px;
    color: #6b7280;
}
</style>
