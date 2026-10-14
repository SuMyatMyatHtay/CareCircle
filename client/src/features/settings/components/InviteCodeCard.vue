<script setup>
import { ref, onUnmounted } from 'vue'
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
  <section class="care-invite-card" aria-labelledby="invite-heading">
    <h2 id="invite-heading">Invite code</h2>
    <p class="care-invite-code">{{ code || 'No code available' }}</p>
    <p class="care-muted care-small">
      Share this with family so they can join from the login page.
    </p>
    <div class="care-actions">
      <button
        class="care-button care-button--primary"
        :disabled="!code"
        @click="copy(code)"
      >
        {{ copied ? 'Copied!' : 'Copy code' }}
      </button>
      <button
        class="care-button"
        :disabled="!isAdmin || busy"
        @click="$emit('regenerate')"
      >
        Regenerate
      </button>
    </div>
    <p v-if="error" class="care-error care-small mt-2 mb-0" role="alert">
      {{ error }}
    </p>
  </section>
</template>
