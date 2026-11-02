// Lets a modal play its closing animation before the parent removes it with v-if.
// requestClose() adds the closing classes; once the panel's animation ends (or after
// the fallback, e.g. under "Reduce motion" where there is no animation) onClosed runs.
//
//   const { closing, requestClose, onAnimationEnd } = useAnimatedClose(() => emit('close'))
//   <section :class="{ 'care-pop-closing': closing }" @animationend="onAnimationEnd">
import { ref, onUnmounted } from 'vue'

export function useAnimatedClose(onClosed, fallbackMs = 200) {
  const closing = ref(false)
  let timer = null
  let done = false

  function finish() {
    if (done) return
    done = true
    clearTimeout(timer)
    onClosed()
  }

  function requestClose() {
    if (closing.value) return
    closing.value = true
    timer = setTimeout(finish, fallbackMs)
  }

  // Only the panel's own closing animation counts, not one bubbling up from a child
  function onAnimationEnd(event) {
    if (closing.value && event.target === event.currentTarget) finish()
  }

  onUnmounted(() => clearTimeout(timer))

  return { closing, requestClose, onAnimationEnd }
}
