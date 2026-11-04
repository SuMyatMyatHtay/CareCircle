<script setup>
// Phones copy the code, the same as the desktop invite card (InviteCodeCard.vue)
import { onUnmounted, ref } from 'vue'
defineProps({
  code: { type: String, default: '' },
  isAdmin: Boolean,
  busy: Boolean,
})
defineEmits(['regenerate'])
const copied = ref(false),
  error = ref('')
let timer
async function copy(code) {
  if (!code) return
  error.value = ''
  try {
    await navigator.clipboard.writeText(code)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    error.value = 'Couldn’t copy automatically. Select and copy the code above.'
  }
}
onUnmounted(() => clearTimeout(timer))
</script>
<template>
  <section class="care-mobile-invite" aria-label="Family invite code">
    <div class="care-mobile-invite-row">
      <div class="care-mobile-invite-copy">
        <h3>INVITE CODE</h3>
        <p>{{ code || 'Unavailable' }}</p>
      </div>
      <div class="care-mobile-invite-actions">
        <button
          class="care-button care-button--primary"
          :disabled="!code"
          @click="copy(code)"
        >
          {{ copied ? 'Copied!' : 'Copy code' }}
        </button>
        <button
          class="care-button care-mobile-regenerate"
          aria-label="Regenerate invite code"
          :disabled="!isAdmin || busy"
          @click="$emit('regenerate')"
        >
          <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <p v-if="copied" class="care-mobile-invite-feedback" role="status">
      Invite code copied. Share it with your family.
    </p>
    <p v-if="error" class="care-error care-small" role="alert">{{ error }}</p>
  </section>
</template>
