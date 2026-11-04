// Light/dark theme. The account is the source of truth (User.appearance on the server),
// so the choice follows the user to every device. localStorage keeps a copy, so
// index.html can apply the theme before Vue loads and there is no light flash.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { updateMyAppearance } from '../../auth/services/authApi.js'

const KEY = 'carecircle:appearance'
const CHOICES = ['light', 'dark', 'system']

const choice = ref(readChoice())
function readChoice() {
  try {
    const value = localStorage.getItem(KEY)
    return CHOICES.includes(value) ? value : 'light'
  } catch {
    return 'light'
  }
}
function hasSavedChoice() {
  try {
    return CHOICES.includes(localStorage.getItem(KEY))
  } catch {
    return false
  }
}
function saveOnDevice(value) {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    /* Keep the in-memory preference. */
  }
}
function saveToAccount(value) {
  let signedIn = false
  try {
    signedIn = Boolean(sessionStorage.getItem('token'))
  } catch {
    /* No session storage: nothing to save to. */
  }
  // If this fails the choice stays on this device; the next change tries again.
  if (signedIn) updateMyAppearance(value).catch(() => {})
}

// Called with the signed-in user from /auth/me. Runs once per account per page load,
// so a reply that was already on its way can't undo a change made just now.
let syncedUserId = null
export function applyAccountAppearance(user) {
  if (!user?.id || user.id === syncedUserId) return
  syncedUserId = user.id
  if (CHOICES.includes(user.appearance)) {
    choice.value = user.appearance
    saveOnDevice(user.appearance)
  } else if (hasSavedChoice()) {
    // Never chosen on the account yet: keep what this browser already uses
    saveToAccount(choice.value)
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
    if (!CHOICES.includes(value)) return
    choice.value = value
    saveOnDevice(value)
    saveToAccount(value)
  }
  return { appearance: choice, theme, setAppearance }
}

// The app root owns the theme, so routes and dialogs teleported to <body>
// inherit the same palette. Page-level callers only read/change the preference.
export function useAppAppearance() {
  const appearance = useAppearance()
  watch(appearance.theme, theme => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.bsTheme = theme
  }, { immediate: true, flush: 'sync' })
  function syncStorage(event) {
    if (event.key === KEY || event.key === null)
      choice.value = readChoice()
  }
  onMounted(() => window.addEventListener('storage', syncStorage))
  onUnmounted(() => window.removeEventListener('storage', syncStorage))
  return appearance
}
