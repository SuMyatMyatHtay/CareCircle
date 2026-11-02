<script setup>
// Owner: SeungHak (F)
// "Add consultation note" on the Task detail and Transit pages.
// The note is written without leaving the page (so a live trip keeps sharing its
// location), saved to the recipient's care log and linked to the task.
// Household tasks (e.g. groceries) have no recipient, so the pop-up first asks who the
// note is about (added by Chaithra, E).
import { computed, onMounted, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import CareModal from '../../../components/common/CareModal.vue'
import { queryKeys } from '../../../services/queryClient.js'
import LogForm from './LogForm.vue'
import { createLog, getLogErrorMessage } from '../services/logsApi.js'
import { showSaved, logName } from '../savedToast.js'
import { getRecipients } from '../../recipients/services/recipientsApi.js'
import { displayName } from '../../recipients/recipientLabels.js'

const props = defineProps({
    familyId: { type: String, required: true },
    recipientId: { type: String, default: '' }, // empty for a household task: pick one below
    recipientName: { type: String, default: '' },
    taskId: { type: String, required: true }
})

const emit = defineEmits(['close', 'saved'])

const queryClient = useQueryClient()
const isSaving = ref(false)
const saveError = ref('')

// ---- Who is this note for? (household tasks only) ----
const askWho = computed(() => !props.recipientId)
const people = ref([])
const pickedId = ref('')
onMounted(async () => {
    if (!askWho.value) return
    try {
        people.value = await getRecipients(props.familyId)
        if (people.value.length === 1) pickedId.value = people.value[0]._id
    } catch {
        saveError.value = 'Could not load the care recipients. Please try again.'
    }
})
const forId = computed(() => props.recipientId || pickedId.value)
const forName = computed(() => props.recipientName || displayName(people.value.find((p) => p._id === pickedId.value)) || '')

async function save(payload) {
    if (!forId.value) {
        saveError.value = 'Pick who this note is for.'
        return
    }
    isSaving.value = true
    saveError.value = ''
    try {
        const log = await createLog(props.familyId, { ...payload, recipient: forId.value, task: props.taskId })
        queryClient.invalidateQueries({ queryKey: queryKeys.logs(props.familyId) })
        emit('saved', log)
        showSaved(`Note saved to ${logName(log)}`)
    } catch (error) {
        saveError.value = getLogErrorMessage(error)
    } finally {
        isSaving.value = false
    }
}

function close() {
    if (!isSaving.value) emit('close')
}
</script>

<template>
    <CareModal class="consultation-note-modal" :title="askWho ? 'Add care note' : 'Add consultation note'" @close="close">
        <template v-if="askWho">
            <p class="modal-intro">Who is this note about? It's saved to their care log and linked to this task.</p>
            <div class="who-chips" role="radiogroup" aria-label="Who is this note for">
                <button
                    v-for="person in people"
                    :key="person._id"
                    type="button"
                    role="radio"
                    class="who-chip"
                    :class="{ 'is-selected': pickedId === person._id }"
                    :aria-checked="pickedId === person._id"
                    :data-testid="`note-for-${person._id}`"
                    @click="pickedId = person._id; saveError = ''"
                >
                    {{ displayName(person) }}
                </button>
                <p v-if="!people.length && !saveError" class="modal-intro">Loading…</p>
            </div>
        </template>
        <p v-else class="modal-intro">
            Saved to {{ recipientName ? `${recipientName}'s` : 'the' }} care log and linked to this visit.
        </p>
        <LogForm
            :recipient-name="forName"
            :is-saving="isSaving"
            :error-message="saveError"
            @submit="save"
        />
    </CareModal>
</template>

<style scoped>
.consultation-note-modal :deep(.care-modal) {
    width: min(100%, 640px);
}

.modal-intro {
    margin: 0 0 12px;
    color: var(--theme-muted, #7B8391);
    font-size: 14px;
}

/* The modal already has a title and a frame */
.who-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
}

.who-chip {
    padding: 6px 14px;
    border: 1px solid var(--theme-border, #DDE5DF);
    border-radius: 999px;
    background: var(--theme-panel, #fff);
    color: var(--theme-text, #2f2f2f);
    font-size: 14px;
    font-weight: 700;
}

.who-chip.is-selected {
    border-color: var(--theme-green, #2d7d43);
    background: var(--theme-green, #2d7d43);
    color: white;
}

.consultation-note-modal :deep(.log-form) {
    padding: 0;
    border: none;
}

.consultation-note-modal :deep(.form-title) {
    display: none;
}
</style>
