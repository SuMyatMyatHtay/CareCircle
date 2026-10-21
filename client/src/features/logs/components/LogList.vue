<script setup>
// Owner: SeungHak (F)
import LogCard from './LogCard.vue'
import LogForm from './LogForm.vue'

defineProps({
    logs: { type: Array, default: () => [] },
    isLoading: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    emptyMessage: { type: String, default: 'No notes yet. Add the first update above.' },
    canChange: { type: Function, default: () => false },
    translate: { type: Function, default: null },
    hasMore: { type: Boolean, default: false },
    isLoadingMore: { type: Boolean, default: false },
    editingId: { type: String, default: '' },
    isSavingEdit: { type: Boolean, default: false },
    editError: { type: String, default: '' }
})

const emit = defineEmits(['retry', 'edit', 'delete', 'load-more', 'save-edit', 'cancel-edit'])
</script>

<template>
    <div v-if="isLoading" class="log-list-status" role="status">
        <div class="spinner-border spinner-border-sm text-success" aria-hidden="true"></div>
        Loading notes...
    </div>

    <div v-else-if="errorMessage" class="log-list-status is-error" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('retry')">
            Try again
        </button>
    </div>

    <div v-else-if="logs.length === 0" class="log-list-empty">
        <i class="bi bi-journal-text" aria-hidden="true"></i>
        <p>{{ emptyMessage }}</p>
    </div>

    <div v-else class="log-list" data-testid="log-list">
        <template v-for="log in logs" :key="log._id">
            <LogForm
                v-if="log._id === editingId"
                :initial-log="log"
                :is-saving="isSavingEdit"
                :error-message="editError"
                @submit="emit('save-edit', log, $event)"
                @cancel="emit('cancel-edit')"
            />
            <LogCard
                v-else
                :log="log"
                :can-change="canChange(log)"
                :translate="translate"
                @edit="emit('edit', $event)"
                @delete="emit('delete', $event)"
            />
        </template>

        <button
            v-if="hasMore"
            type="button"
            class="load-more"
            :disabled="isLoadingMore"
            @click="emit('load-more')"
        >
            <span v-if="isLoadingMore" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            {{ isLoadingMore ? 'Loading...' : 'Load older notes' }}
        </button>
    </div>
</template>

<style scoped>
.log-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.log-list-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0;
    padding: 18px 4px;
    color: var(--theme-muted, #7B8391);
    font-size: 14px;
}

.log-list-status.is-error {
    color: var(--theme-danger, #C0564B);
}

.log-list-empty {
    padding: 36px 16px;
    text-align: center;
    color: var(--theme-muted, #7B8391);
    background: var(--theme-panel, white);
    border: 1px dashed var(--theme-border, #D5E2D8);
    border-radius: 14px;
}

.log-list-empty .bi {
    font-size: 28px;
    color: var(--theme-muted, #9DBFA6);
}

.log-list-empty p {
    margin: 8px 0 0;
    font-size: 15px;
}

.load-more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    align-self: center;
    padding: 8px 18px;
    border: 1px solid var(--theme-accent-border, #B5DDC0);
    border-radius: 999px;
    background: var(--theme-panel, white);
    color: var(--theme-green, #3B7A4F);
    font-size: 14px;
    font-weight: 700;
}

.load-more:hover:not(:disabled) {
    background: var(--theme-soft, #EAF4EC);
}
</style>
