<script setup>
// Owner: SeungHak (F)
// Care log notes linked to one task ("Notes from this visit").
// Used on the Task detail and Transit pages, with the same cards as the Log page:
// translate, and edit / delete for the author or a family admin.
// add(log) shows a new note straight away.
import { onMounted, ref, watch } from 'vue'
import { getLogs } from '../services/logsApi.js'
import { useLogActions } from '../useLogActions.js'
import LogList from './LogList.vue'

const props = defineProps({
    familyId: { type: String, required: true },
    taskId: { type: String, required: true },
    emptyText: { type: String, default: 'No notes yet.' }
})

const notes = ref([])
const actions = useLogActions(() => props.familyId, notes)
const { editingId, isSavingEdit, editError, actionError } = actions

async function load() {
    try {
        notes.value = await getLogs(props.familyId, { task: props.taskId, limit: 10 })
    } catch {
        notes.value = [] // the page still works without its notes
    }
}

function add(log) {
    notes.value = [log, ...notes.value.filter((note) => note._id !== log._id)]
}

onMounted(load)
watch(() => [props.familyId, props.taskId], load)
defineExpose({ add, reload: load })
</script>

<template>
    <div class="visit-notes" data-testid="visit-notes">
        <p v-if="actionError" class="action-error" role="alert">
            {{ actionError }}
            <button type="button" aria-label="Dismiss" @click="actionError = ''">
                <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
        </p>

        <LogList
            :logs="notes"
            :empty-message="emptyText"
            :can-change="actions.canChange"
            :translate="actions.translate"
            compact
            :editing-id="editingId"
            :is-saving-edit="isSavingEdit"
            :edit-error="editError"
            @edit="actions.startEdit"
            @delete="actions.removeLog"
            @save-edit="actions.saveEdit"
            @cancel-edit="actions.cancelEdit"
        />
    </div>
</template>

<style scoped>
.visit-notes {
    margin-bottom: 12px;
}

.action-error {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
    font-size: 13px;
}

.action-error button {
    margin-left: auto;
    border: none;
    background: transparent;
    color: inherit;
}

/* The task pages' side column is narrow, so the cards and the edit form sit tighter */
.visit-notes :deep(.log-card) {
    padding: 12px 14px;
}

.visit-notes :deep(.log-form) {
    padding: 12px 14px;
}

.visit-notes :deep(.log-list-empty) {
    padding: 0;
    border: none;
    background: none;
    text-align: left;
}

.visit-notes :deep(.log-list-empty i) {
    display: none;
}
</style>
