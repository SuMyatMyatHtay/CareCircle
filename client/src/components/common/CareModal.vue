<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useAnimatedClose } from '../../composables/useAnimatedClose.js'
defineProps({ title: { type: String, required: true } })
const emit = defineEmits(['close'])
const panel = ref(null)
// Escape, the backdrop and the close button all fade the dialog out before 'close'
const { closing, requestClose, onAnimationEnd } = useAnimatedClose(() => emit('close'))
let previousFocus
function onKeydown(event) {
  if (event.key === 'Escape') requestClose()
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
  <!-- Parents mount this with v-if, so it animates in with appear and out with `closing` -->
  <Transition name="care-backdrop" appear>
  <div
    class="care-modal-backdrop"
    :class="{ 'care-backdrop-closing': closing }"
    @click.self="requestClose"
  >
    <Transition name="care-pop" appear>
    <section
      ref="panel"
      class="care-modal"
      :class="{ 'care-pop-closing': closing }"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
      @animationend="onAnimationEnd"
    >
      <header>
        <h2>{{ title }}</h2>
        <button
          type="button"
          class="care-icon-button"
          aria-label="Close dialog"
          @click="requestClose"
        >
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </header>
      <slot />
    </section>
    </Transition>
  </div>
  </Transition>
</template>
