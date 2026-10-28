<script setup>
// Owner: SeungHak (F)
// "Notes from this visit" on the Task detail and Transit pages, desktop and phone.
// Shows the care log notes linked to the task (translate; edit and delete for the author
// or an admin), with "+ Add consultation note". Adding and editing both open a pop-up,
// so a narrow column never has to fit the whole form.
//   <VisitNotesCard :family-id="familyId" :task-id="taskId" :recipient-id="id" recipient-name="Grandpa" />
import { computed, onMounted, ref, watch } from 'vue'
import CareModal from '../../../components/common/CareModal.vue'
import { getLogs } from '../services/logsApi.js'
import { useLogActions } from '../useLogActions.js'
import LogList from './LogList.vue'
import LogForm from './LogForm.vue'
import ConsultationNoteModal from './ConsultationNoteModal.vue'

const props = defineProps({
    familyId: { type: String, required: true },
    taskId: { type: String, required: true },
    recipientId: { type: String, default: '' },     // empty for a household task
    recipientName: { type: String, default: '' },
    emptyText: { type: String, default: "No notes yet. Whoever goes can add what the doctor said, so the family doesn't need to ask." }
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
onMounted(load)
watch(() => [props.familyId, props.taskId], load)

// ---- Add ----
const isAdding = ref(false)
function added(log) {
    isAdding.value = false
    notes.value = [log, ...notes.value.filter((note) => note._id !== log._id)]
}

// ---- Edit (in a pop-up, not inside the list) ----
const editingNote = computed(() => notes.value.find((note) => note._id === editingId.value) || null)
function closeEdit() {
    if (!isSavingEdit.value) actions.cancelEdit()
}
</script>

<template>
    <section class="visit-notes-card" data-testid="visit-notes">
        <h2 class="visit-notes-title">Notes from this visit</h2>

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
            @edit="actions.startEdit"
            @delete="actions.removeLog"
        />

        <button
            v-if="recipientId"
            type="button"
            class="add-note-button"
            data-testid="task-add-note"
            @click="isAdding = true"
        >
            <i class="bi bi-plus-lg" aria-hidden="true"></i> Add consultation note
        </button>
        <p v-else class="visit-notes-hint">
            Consultation notes go in a care recipient's log, and this task isn't for one.
        </p>

        <ConsultationNoteModal
            v-if="isAdding"
            :family-id="familyId"
            :recipient-id="recipientId"
            :recipient-name="recipientName"
            :task-id="taskId"
            @close="isAdding = false"
            @saved="added"
        />

        <CareModal v-if="editingNote" class="note-modal" title="Edit note" @close="closeEdit">
            <LogForm
                :initial-log="editingNote"
                :is-saving="isSavingEdit"
                :error-message="editError"
                @submit="actions.saveEdit(editingNote, $event)"
                @cancel="closeEdit"
            />
        </CareModal>
    </section>
</template>

<style scoped>
.visit-notes-title {
    margin: 0 0 10px;
    font-size: 16px;
    font-weight: 700;
}

.visit-notes-card :deep(.log-card) {
    padding: 12px 14px;
}

.visit-notes-card :deep(.log-list-empty) {
    padding: 0;
    border: none;
    background: none;
    color: var(--theme-muted, #6b7280);
    text-align: left;
}

.visit-notes-card :deep(.log-list-empty i) {
    display: none;
}

.add-note-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 9px 14px;
    border: 1px solid var(--theme-border, #dfe3e8);
    border-radius: 12px;
    background: var(--theme-panel, #fff);
    color: var(--theme-text, #2f2f2f);
    font-size: 14px;
    font-weight: 700;
}

.add-note-button:hover {
    border-color: var(--theme-green, #2d7d43);
    color: var(--theme-green, #2d7d43);
}

.visit-notes-hint {
    margin: 10px 0 0;
    color: var(--theme-muted, #6b7280);
    font-size: 13px;
}

.action-error {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--theme-danger-soft, #fff0eb);
    color: var(--theme-danger, #c0564b);
    font-size: 13px;
}

.action-error button {
    margin-left: auto;
    border: none;
    background: transparent;
    color: inherit;
}

/* The pop-up already has a title and a frame */
.note-modal :deep(.care-modal) {
    width: min(100%, 640px);
}

.note-modal :deep(.log-form) {
    padding: 0;
    border: none;
    background: none;
}

.note-modal :deep(.form-title) {
    display: none;
}
</style>
