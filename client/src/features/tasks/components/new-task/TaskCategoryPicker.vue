<script setup>
// Owner: Marcus (D)
// The 8 task categories as icon tiles, 4 per row.
//   <TaskCategoryPicker v-model="form.category.value" />
import { TASK_CATEGORIES } from '../../composables/useTaskForm.js'

defineProps({
    error: { type: String, default: '' }
})

const model = defineModel({ type: String, default: 'other' })
</script>

<template>
    <fieldset class="task-field">
        <legend class="task-label">Category</legend>
        <div class="category-grid">
            <button v-for="option in TASK_CATEGORIES" :key="option.value" type="button" class="category-tile"
                :class="{ selected: model === option.value }" :aria-pressed="model === option.value"
                @click="model = option.value">
                <i class="bi" :class="option.icon" aria-hidden="true"></i>
                <span>{{ option.label }}</span>
            </button>
        </div>
        <p v-if="error" class="task-field-error" role="alert">{{ error }}</p>
    </fieldset>
</template>

<style scoped>
.category-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
}

.category-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 64px;
    padding: 12px 4px 10px;
    border: 1px solid var(--theme-border, #E5E7EB);
    border-radius: 12px;
    background: var(--theme-panel, white);
    color: var(--theme-text, #2F2F2F);
    font-size: 12px;
    font-weight: 500;
}

.category-tile .bi {
    font-size: 20px;
    line-height: 1;
}

.category-tile span {
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.category-tile:hover {
    background: var(--theme-page, #F7FAF7);
}

.category-tile.selected {
    padding: 11px 3px 9px;
    border: 2px solid var(--theme-accent-border, #2F7A3F);
    background: var(--theme-soft, #E8F5E9);
    color: var(--theme-green, #1F5A2C);
    font-weight: 600;
}

.category-tile.selected .bi {
    color: var(--theme-green, #2F7A3F);
}

.category-tile:focus-visible {
    outline: 3px solid var(--theme-accent-border, #A8D5B5);
    outline-offset: 2px;
}

/* 4 tiles across a phone leaves ~74px each; "Appointment" needs the smaller size */
@media (max-width: 420px) {
    .category-tile {
        font-size: 11px;
    }
}
</style>
