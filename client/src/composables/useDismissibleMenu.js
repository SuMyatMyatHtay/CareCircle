import { onMounted, onUnmounted, toValue } from 'vue'

// Accept a ref or getter so a list can identify its currently open menu.
export function useDismissibleMenu(root, dismiss) {
  function outside(event) {
    const element = toValue(root)
    if (element && !element.contains(event.target)) dismiss()
  }
  function escape(event) {
    const element = toValue(root)
    if (event.key !== 'Escape' || !element) return
    dismiss()
    element.querySelector('button')?.focus({ preventScroll: true })
  }
  onMounted(() => {
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
  })
  onUnmounted(() => {
    document.removeEventListener('pointerdown', outside, true)
    document.removeEventListener('focusin', outside)
    document.removeEventListener('keydown', escape)
  })
}
