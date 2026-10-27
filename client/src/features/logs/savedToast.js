// Owner: SeungHak (F)
// The small green confirmation at the top of the screen, shared by every care log action.
// A page renders <SavedToast /> once; anything can then call showSaved('...').
import { ref } from 'vue'
import { displayName } from '../recipients/recipientLabels.js'

export const savedToast = ref({ id: 0, text: '' })

export function showSaved(text) {
    savedToast.value = { id: savedToast.value.id + 1, text }
}

export function hideSaved() {
    savedToast.value = { ...savedToast.value, text: '' }
}

// "Grandpa's log", or "the care log" when the note has no recipient name
export function logName(log) {
    const name = displayName(log?.recipient)
    return name ? `${name}'s log` : 'the care log'
}
