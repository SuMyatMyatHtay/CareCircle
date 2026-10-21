<script setup>
defineProps({
  active: { type: String, default: 'me' },
  homePath: { type: String, required: true },
})
defineEmits(['select'])
const tabs = [
  { key: 'tasks', label: 'Tasks', icon: 'bi-check-square' },
  { key: 'calendar', label: 'Calendar', icon: 'bi-calendar3' },
  { key: 'family', label: 'Family', icon: 'bi-bar-chart' },
  { key: 'me', label: 'Me', icon: 'bi-person' },
]
</script>
<template>
  <nav
    class="care-mobile-settings-navigation"
    aria-label="Mobile settings navigation"
  >
    <RouterLink :to="homePath">
      <i class="bi bi-house-door" aria-hidden="true"></i>
      <span>Home</span>
    </RouterLink>
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :class="{ selected: active === tab.key }"
      :aria-pressed="active === tab.key"
      @click="$emit('select', tab.key)"
    >
      <i class="bi" :class="tab.icon" aria-hidden="true"></i>
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>
