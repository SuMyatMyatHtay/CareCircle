<script setup>
// Owner: SeungHak (F)
// "Add consultation note" on the Task detail and Transit pages.
// The note is written without leaving the page (so a live trip keeps sharing its
// location), saved to the recipient's care log and linked to the task.
import { ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import CareModal from '../../../components/common/CareModal.vue'
import { queryKeys } from '../../../services/queryClient.js'
import LogForm from './LogForm.vue'
import { createLog, getLogErrorMessage } from '../services/logsApi.js'
import { showSaved, logName } from '../savedToast.js'

const props = defineProps({
    familyId: { type: String, required: true },
    recipientId: { type: String, required: true },
    recipientName: { type: String, default: '' },
    taskId: { type: String, required: true }
})

const emit = defineEmits(['close', 'saved'])

const queryClient = useQueryClient()
const isSaving = ref(false)
const saveError = ref('')

async function save(payload) {
    isSaving.value = true
    saveError.value = ''
    try {
        const log = await createLog(props.familyId, { ...payload, recipient: props.recipientId, task: props.taskId })
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
    <CareModal class="consultation-note-modal" title="Add consultation note" @close="close">
        <p class="modal-intro">
            Saved to {{ recipientName ? `${recipientName}'s` : 'the' }} care log and linked to this visit.
        </p>
        <LogForm
            :recipient-name="recipientName"
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
.consultation-note-modal :deep(.log-form) {
    padding: 0;
    border: none;
}

.consultation-note-modal :deep(.form-title) {
    display: none;
}
</style>
