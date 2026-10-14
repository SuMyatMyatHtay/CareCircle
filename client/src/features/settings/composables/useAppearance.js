import { computed, onMounted, onUnmounted, ref } from 'vue'

const choice = ref(readChoice())
function readChoice() {
  try {
    const value = localStorage.getItem('carecircle:appearance')
    return ['light', 'dark', 'system'].includes(value) ? value : 'light'
  } catch {
    return 'light'
  }
}
export function useAppearance() {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const deviceDark = ref(media.matches)
  const theme = computed(() =>
    choice.value === 'system'
      ? deviceDark.value
        ? 'dark'
        : 'light'
      : choice.value,
  )
  function syncDevice(event) {
    deviceDark.value = event.matches
  }
  onMounted(() => media.addEventListener('change', syncDevice))
  onUnmounted(() => media.removeEventListener('change', syncDevice))
  function setAppearance(value) {
    if (!['light', 'dark', 'system'].includes(value)) return
    choice.value = value
    try {
      localStorage.setItem('carecircle:appearance', value)
    } catch {
      /* Keep the in-memory preference. */
    }
  }
  return { appearance: choice, theme, setAppearance }
}
