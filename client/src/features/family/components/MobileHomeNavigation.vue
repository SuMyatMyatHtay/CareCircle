<script setup>
defineProps({
  active: { type: String, default: 'home' },
  homePath: { type: String, required: true },
  settingsPath: { type: String, required: true },
  contributionsEnabled: Boolean,
  preview: Boolean,
})
defineEmits(['select'])
const tabs = [
  { key: 'tasks', label: 'Tasks', icon: 'bi-list-check' },
  { key: 'people', label: 'People', icon: 'bi-people' },
  { key: 'activity', label: 'Activity', icon: 'bi-activity' },
]
</script>

<template>
  <nav class="care-mobile-home-navigation" :style="{ gridTemplateColumns: `repeat(${preview ? 5 : 6}, minmax(0, 1fr))` }" aria-label="Mobile home navigation">
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
    <RouterLink v-if="contributionsEnabled && !preview" to="/contributions">
      <i class="bi bi-trophy" aria-hidden="true"></i><span>Contributions</span>
    </RouterLink>
    <span v-else-if="!preview" tabindex="0" aria-disabled="true" title="Join a family first to view contributions." style="font-size:10px; text-align:center; color:var(--theme-muted,#717b8e)"><i class="bi bi-lock" aria-hidden="true"></i><br>Contributions</span>
    <RouterLink :to="settingsPath">
      <i class="bi bi-person" aria-hidden="true"></i>
      <span>Me</span>
    </RouterLink>
  </nav>
</template>
