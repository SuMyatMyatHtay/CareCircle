<script setup>
import { onUnmounted, ref } from 'vue'
const props = defineProps({
  code: { type: String, default: '' },
  familyName: { type: String, default: 'Your family' },
  isAdmin: Boolean,
  preview: Boolean,
  busy: Boolean,
})
defineEmits(['regenerate'])
const copied = ref(false),
  sharing = ref(false),
  error = ref('')
let timer
async function shareCode() {
  if (!props.code || sharing.value) return
  sharing.value = true
  error.value = ''
  try {
    if (!props.preview && typeof navigator.share === 'function') {
      await navigator.share({
        title: `${props.familyName} on CareCircle`,
        text: `Join ${props.familyName} on CareCircle. Invite code: ${props.code}`,
      })
    } else {
      await navigator.clipboard.writeText(props.code)
      copied.value = true
      clearTimeout(timer)
      timer = setTimeout(() => {
        copied.value = false
      }, 3000)
    }
  } catch (err) {
    if (err.name !== 'AbortError')
      error.value =
        'Select and copy the code above to share it with your family.'
  } finally {
    sharing.value = false
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
          :disabled="!code || sharing"
          @click="shareCode"
        >
          {{ copied ? 'Copied!' : sharing ? 'Sharing…' : 'Share' }}
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
