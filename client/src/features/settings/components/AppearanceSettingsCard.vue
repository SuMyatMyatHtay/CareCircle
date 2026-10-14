<script setup>
import SectionCard from '../../../components/common/SectionCard.vue'
defineProps({ appearance: { type: String, default: 'light' } })
defineEmits(['change'])
const options = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match my device' },
]
</script>
<template>
  <SectionCard title="Appearance" class="care-appearance-card">
    <div
      class="care-appearance-options"
      role="group"
      aria-label="Color appearance"
    >
      <button
        v-for="option in options"
        :key="option.value"
        class="care-appearance-option"
        :class="{ selected: appearance === option.value }"
        :aria-pressed="appearance === option.value"
        @click="$emit('change', option.value)"
      >
        <span
          class="care-theme-swatch"
          :class="`care-theme-swatch--${option.value}`"
        ></span>
        <span>
          <i
            class="bi"
            :class="
              appearance === option.value
                ? 'bi-record-circle-fill'
                : 'bi-circle'
            "
            aria-hidden="true"
          ></i>
          {{ option.label }}
        </span>
      </button>
    </div>
  </SectionCard>
</template>
