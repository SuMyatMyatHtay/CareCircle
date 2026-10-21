<script setup>
defineProps({
  message: { type: String, default: '' },
  error: Boolean,
  detail: { type: String, default: 'The board is up to date.' },
})
defineEmits(['close'])
</script>
<template>
  <Transition name="care-toast">
    <div v-if="message" class="care-live-toast" role="status">
      <span class="care-toast-icon">
        <i
          class="bi"
          :class="error ? 'bi-exclamation-lg' : 'bi-check2'"
          aria-hidden="true"
        ></i>
      </span>
      <div>
        <strong>{{ message }}</strong>
        <small>
          {{ error ? 'Check the latest tasks and try again.' : detail }}
        </small>
      </div>
      <button
        class="care-icon-button"
        aria-label="Dismiss notification"
        @click="$emit('close')"
      >
        <i class="bi bi-x" aria-hidden="true"></i>
      </button>
    </div>
  </Transition>
</template>
