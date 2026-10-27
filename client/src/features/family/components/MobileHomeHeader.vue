<script setup>
import CareAvatar from '../../../components/common/CareAvatar.vue'
defineProps({
  familyName: { type: String, default: 'Your family' },
  date: { type: String, required: true },
  greeting: { type: String, required: true },
  user: { type: Object, required: true },
  settingsPath: { type: String, required: true },
  canSwitchFamily: Boolean,
  preview: Boolean,
})
defineEmits(['switch-family'])
</script>

<template>
  <header class="care-mobile-home-header">
    <div class="care-mobile-home-heading">
      <div class="care-mobile-family-line">
        <button
          v-if="canSwitchFamily"
          @click="$emit('switch-family')"
          :aria-label="`Switch family, currently ${familyName}`"
        >
          {{ familyName }}
          <i class="bi bi-chevron-down" aria-hidden="true"></i>
        </button>
        <span v-else>{{ familyName }}</span>
        <span aria-hidden="true">·</span>
        <time>{{ date }}</time>
        <span v-if="preview" class="care-mobile-preview-label">Preview</span>
      </div>
      <h1>{{ greeting }}</h1>
    </div>
    <div class="care-mobile-header-actions">
      <!-- F (SeungHak): phones have no sidebar on Home, so the Calendar is reached from here -->
      <RouterLink v-if="!preview" to="/calendar" class="care-mobile-calendar" aria-label="Open the family calendar">
        <i class="bi bi-calendar3" aria-hidden="true"></i>
      </RouterLink>
      <RouterLink
        :to="preview ? settingsPath : '/profile'"
        class="care-mobile-account"
        aria-label="Open my profile"
      >
        <CareAvatar :person="user" size="small" />
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.care-mobile-header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}
.care-mobile-calendar {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--care-border, #dfe3e8);
  border-radius: 50%;
  background: var(--theme-panel, #fff);
  color: var(--care-green, #2d7d43);
  font-size: 16px;
}
</style>
