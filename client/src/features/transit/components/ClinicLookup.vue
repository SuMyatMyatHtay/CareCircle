<script setup>
import { ref } from 'vue'
import ClinicSearch from './ClinicSearch.vue'

const place = ref(null)
function directionsUrl(location) {
  const target = Number.isFinite(location.lat) && Number.isFinite(location.lng)
    ? `${location.lat},${location.lng}`
    : [location.name, location.address].filter(Boolean).join(' ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`
}
</script>

<template>
  <details class="card clinic-lookup">
    <summary><i class="bi bi-search" aria-hidden="true"></i> Find a clinic with OneMap</summary>
    <ClinicSearch @select="place = $event" />
    <div v-if="place" class="clinic-lookup-result">
      <span><strong>{{ place.name }}</strong><small>{{ place.address }}</small></span>
      <a :href="directionsUrl(place)" target="_blank" rel="noopener">Directions</a>
    </div>
  </details>
</template>

<style scoped>
.clinic-lookup { padding: 14px 16px; }
.clinic-lookup summary { min-height: 24px; font-size: 14px; font-weight: 600; color: var(--theme-green, #2f7a3f); cursor: pointer; }
.clinic-lookup[open] summary { margin-bottom: 10px; }
.clinic-lookup-result { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; }
.clinic-lookup-result span { display: grid; min-width: 0; overflow-wrap: anywhere; }
.clinic-lookup-result strong { font-size: 14px; color: var(--theme-text, #2e2e2e); }
.clinic-lookup-result small { font-size: 12px; color: var(--theme-muted, #6b7280); }
.clinic-lookup-result a { padding-block: 10px; font-size: 14px; font-weight: 600; color: var(--theme-green, #2f7a3f); }
@media (max-width: 767.98px) { .clinic-lookup summary { min-height: 44px; } }
</style>
