<script setup>
defineProps({
  appearance: { type: String, default: 'light' },
  language: { type: String, default: 'en' },
  familyName: { type: String, default: 'Your family' },
  preview: Boolean,
  busy: Boolean,
})
defineEmits(['appearance', 'language', 'telegram'])
</script>
<template>
  <section class="care-mobile-preferences" aria-label="Your preferences">
    <div class="care-mobile-preference-row">
      <h2>Appearance</h2>
      <div
        class="care-mobile-theme-switch"
        role="group"
        aria-label="Color appearance"
      >
        <button
          v-for="option in ['light', 'dark']"
          :key="option"
          :aria-pressed="appearance === option"
          :class="{ selected: appearance === option }"
          @click="$emit('appearance', option)"
        >
          {{ option === 'light' ? 'Light' : 'Dark' }}
        </button>
      </div>
    </div>
    <div class="care-mobile-preference-row">
      <label for="mobile-notes-language">Notes language</label>
      <select
        id="mobile-notes-language"
        :value="language"
        :disabled="busy"
        @change="$emit('language', $event.target.value)"
      >
        <option value="en">English</option>
        <option value="zh">中文</option>
        <option value="ms">Bahasa Melayu</option>
        <option value="ta">தமிழ்</option>
      </select>
    </div>
    <div class="care-mobile-preference-row">
      <div>
        <h2>Telegram updates</h2>
        <p :class="{ linked: preview }">
          {{ preview ? `Linked to “${familyName}” group` : 'Not linked yet' }}
        </p>
      </div>
      <button class="care-text-button" @click="$emit('telegram')">
        Manage
      </button>
    </div>
  </section>
</template>
