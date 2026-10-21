<script setup>
defineProps({
  active: { type: String, default: 'home' },
  homePath: { type: String, required: true },
  settingsPath: { type: String, required: true },
})
defineEmits(['select'])
const tabs = [
  { key: 'tasks', label: 'Tasks', icon: 'bi-list-check' },
  { key: 'people', label: 'People', icon: 'bi-people' },
  { key: 'activity', label: 'Activity', icon: 'bi-activity' },
]
</script>

<template>
  <nav class="care-mobile-home-navigation" aria-label="Mobile home navigation">
    <RouterLink
      :to="homePath"
      :class="{ selected: active === 'home' }"
      :aria-current="active === 'home' ? 'page' : undefined"
      @click="$emit('select', 'home')"
    >
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
    <RouterLink :to="settingsPath">
      <i class="bi bi-person" aria-hidden="true"></i>
      <span>Me</span>
    </RouterLink>
  </nav>
</template>
