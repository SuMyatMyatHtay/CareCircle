// Shared "which family am I looking at" state for every logged-in page.
// The state lives at module level, so every component that calls
// useActiveFamily() sees the same families and the same selection.
//
//   const { selectedFamilyId } = useActiveFamily()
//   http.get(`/families/${selectedFamilyId.value}/tasks`)

import { ref, computed } from 'vue'
import { getMyFamilies, getFamilyErrorMessage } from '../features/family/services/familyApi.js'

const families = ref([])
const selectedFamilyId = ref(sessionStorage.getItem('activeFamilyId') || '')
const isLoading = ref(false)
const errorMessage = ref('')

const selectedFamily = computed(
  () => families.value.find((f) => f.id === selectedFamilyId.value) || null
)

// Load the logged-in user's families and keep the previous selection if it is still valid
async function loadFamilies() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await getMyFamilies()
    if (!Array.isArray(result)) {
      throw new Error('Invalid family data from server.')
    }

    families.value = result
    const stillMine = result.some((f) => f.id === selectedFamilyId.value)
    selectFamily(stillMine ? selectedFamilyId.value : result[0]?.id || '')
  } catch (error) {
    errorMessage.value = getFamilyErrorMessage(error)
    families.value = []
    selectFamily('')
  } finally {
    isLoading.value = false
  }
}

function selectFamily(familyId) {
  selectedFamilyId.value = familyId
  if (familyId) sessionStorage.setItem('activeFamilyId', familyId)
  else sessionStorage.removeItem('activeFamilyId')
}

// Call on logout so the next user doesn't see the previous user's families
function clearFamilies() {
  families.value = []
  selectFamily('')
}

export function useActiveFamily() {
  return {
    families,
    selectedFamilyId,
    selectedFamily,
    isLoading,
    errorMessage,
    loadFamilies,
    selectFamily,
    clearFamilies
  }
}