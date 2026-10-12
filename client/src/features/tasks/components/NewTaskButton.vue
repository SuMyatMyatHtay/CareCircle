<script setup>
// "+ New task" button. Emits "create"; the parent decides what happens
// (the task form isn't built yet).
const emit = defineEmits(['create'])
</script>

<template>
    <button type="button" class="new-task-button" @click="emit('create')">
        <i class="bi bi-plus-lg" aria-hidden="true"></i>
        New task
    </button>
</template>

<style scoped>
.new-task-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 11px 18px;
    border: none;
    border-radius: 10px;
    background: #2E7D43;
    color: white;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
}

.new-task-button:hover {
    background: #256836;
}

.new-task-button:focus-visible {
    outline: 3px solid #A8D5B5;
    outline-offset: 2px;
}
</style>
