<script setup>
import SectionCard from '../../../components/common/SectionCard.vue'
defineProps({ language: { type: String, default: 'en' }, busy: Boolean })
defineEmits(['change'])
const languages = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'ta', label: 'தமிழ்' },
]
</script>
<template>
  <SectionCard title="Your language" class="care-language-card">
    <p class="care-muted care-small">
      Choose the language you’re most comfortable reading. Care note translation
      will use this preference when LibreTranslate is connected.
    </p>
    <div
      class="care-language-options"
      role="group"
      aria-label="Preferred language"
    >
      <button
        v-for="option in languages"
        :key="option.code"
        class="care-language-chip"
        :class="{ selected: language === option.code }"
        :aria-pressed="language === option.code"
        :disabled="busy"
        @click="$emit('change', option.code)"
      >
        {{ option.label }}
      </button>
    </div>
  </SectionCard>
</template>
