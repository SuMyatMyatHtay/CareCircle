// Shared list of the selected family's care recipients (package C).
// The state lives at module level, so the sidebar, Family home and the
// recipient pages all see the same list. Call refresh() after a create,
// edit or archive so every place updates.
//
//   const { recipients, loadRecipients } = useRecipients()
//   watch(selectedFamilyId, loadRecipients, { immediate: true })

import { ref } from 'vue'
import { getRecipients, getRecipientErrorMessage } from '../features/recipients/services/recipientsApi.js'

const recipients = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
let loadedFamilyId = ''

async function loadRecipients(familyId) {
    loadedFamilyId = familyId || ''
    errorMessage.value = ''

    if (!familyId) {
        recipients.value = []
        return
    }

    isLoading.value = true
    try {
        const result = await getRecipients(familyId)
        // Ignore the reply if another family was picked while it was loading
        if (familyId === loadedFamilyId) recipients.value = result
    } catch (error) {
        if (familyId === loadedFamilyId) {
            recipients.value = []
            errorMessage.value = getRecipientErrorMessage(error)
        }
    } finally {
        if (familyId === loadedFamilyId) isLoading.value = false
    }
}

function refresh() {
    return loadRecipients(loadedFamilyId)
}

export function useRecipients() {
    return {
        recipients,
        isLoading,
        errorMessage,
        loadRecipients,
        refresh
    }
}
