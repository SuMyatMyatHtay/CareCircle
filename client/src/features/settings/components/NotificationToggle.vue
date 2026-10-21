<script setup>
defineProps({
  label: { type: String, required: true },
  checked: Boolean,
  disabled: Boolean,
})
defineEmits(['change'])
</script>
<template>
  <label class="care-notification-toggle">
    <span>{{ label }}</span>
    <input
      type="checkbox"
      role="switch"
      :checked="checked"
      :disabled="disabled"
      :aria-label="label"
      @change="$emit('change', $event.target.checked)"
    />
    <span class="care-switch-track" aria-hidden="true"></span>
  </label>
</template>
