<script setup>
// Owner: SeungHak (F)
import { computed } from 'vue'
import { LOG_TYPES } from '../logTypes.js'

const props = defineProps({
    logs: { type: Array, default: () => [] },
    modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const options = computed(() => [
    { value: '', label: 'All updates', count: props.logs.length },
    ...LOG_TYPES.map((type) => ({
        value: type.value,
        label: type.plural,
        count: props.logs.filter((log) => log.type === type.value).length
    }))
])
</script>

<template>
    <nav class="type-filter" aria-label="Filter notes by type">
        <h2 class="filter-title">Show</h2>
        <ul>
            <li v-for="option in options" :key="option.value || 'all'">
                <button
                    type="button"
                    class="filter-option"
                    :class="{ 'is-active': modelValue === option.value }"
                    :aria-pressed="modelValue === option.value"
                    :data-testid="`log-filter-${option.value || 'all'}`"
                    @click="emit('update:modelValue', option.value)"
                >
                    <span>{{ option.label }}</span>
                    <span class="filter-count">{{ option.count }}</span>
                </button>
            </li>
        </ul>
    </nav>
</template>

<style scoped>
.type-filter {
    padding: 18px 14px;
    background: var(--theme-panel, white);
    border: 1px solid var(--theme-border, #E4ECE5);
    border-radius: 14px;
}

.filter-title {
    margin: 0 6px 10px;
    font-size: 15px;
    font-weight: 800;
    color: var(--theme-text, #2F2F2F);
}

.type-filter ul {
    margin: 0;
    padding: 0;
    list-style: none;
}

.filter-option {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 7px 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text, #4A4F57);
    font-size: 14px;
    text-align: left;
}

.filter-option:hover {
    background: var(--theme-page, #F5F7F5);
}

.filter-option.is-active {
    background: var(--theme-soft, #EAF4EC);
    color: var(--theme-green, #2E7D43);
    font-weight: 700;
}

.filter-count {
    color: var(--theme-muted, #9AA1AB);
}

.is-active .filter-count {
    color: var(--theme-green, #2E7D43);
}

@media (max-width: 991px) {
    .type-filter {
        padding: 0;
        background: transparent;
        border: none;
    }

    .filter-title {
        display: none;
    }

    .type-filter ul {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
    }

    .filter-option {
        width: auto;
        gap: 6px;
        white-space: nowrap;
        padding: 6px 12px;
        border: 1px solid var(--theme-border, #E4ECE5);
        border-radius: 999px;
        background: var(--theme-panel, white);
    }
}
</style>
