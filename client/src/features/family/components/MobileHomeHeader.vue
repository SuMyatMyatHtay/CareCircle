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
    <RouterLink
      :to="preview ? settingsPath : '/profile'"
      class="care-mobile-account"
      aria-label="Open my profile"
    >
      <CareAvatar :person="user" size="small" />
    </RouterLink>
  </header>
</template>
