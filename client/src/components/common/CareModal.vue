<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
defineProps({ title: { type: String, required: true } })
const emit = defineEmits(['close'])
const panel = ref(null)
let previousFocus
function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
  if (event.key !== 'Tab') return
  const controls = [
    ...panel.value.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    ),
  ].filter((node) => node.getClientRects().length)
  const first = controls[0],
    last = controls.at(-1)
  if (!controls.length) {
    event.preventDefault()
    panel.value.focus()
  } else if (document.activeElement === panel.value) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
onMounted(() => {
  previousFocus = document.activeElement
  panel.value.focus()
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  previousFocus?.focus()
})
</script>

<template>
  <div class="care-modal-backdrop" @click.self="emit('close')">
    <section
      ref="panel"
      class="care-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
    >
      <header>
        <h2>{{ title }}</h2>
        <button
          type="button"
          class="care-icon-button"
          aria-label="Close dialog"
          @click="emit('close')"
        >
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </header>
      <slot />
    </section>
  </div>
</template>
