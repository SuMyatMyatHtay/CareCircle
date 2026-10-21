<script setup>
// Owner: Marcus (D)
// Lavender card with a switch: does this task need someone to take them there?
// Disabled until a place is picked.
//   <TaskTransitToggle v-model="form.needsTransit.value" :disabled="!form.location.value" />
import { useId } from 'vue'

defineProps({
    disabled: { type: Boolean, default: false }
})

const model = defineModel({ type: Boolean, default: false })
const id = useId()
</script>

<template>
    <label class="transit-card" :class="{ 'is-disabled': disabled }" :for="`${id}-transit`">
        <span class="transit-icon" aria-hidden="true"><i class="bi bi-car-front"></i></span>
        <span class="transit-text">
            <strong>Needs someone to take them there</strong>
            <small>
                {{ disabled ? 'Pick a place first' : 'Whoever claims it gets transit mode, with live updates for the family' }}
            </small>
        </span>
        <span class="form-check form-switch m-0">
            <input :id="`${id}-transit`" v-model="model" class="form-check-input transit-switch" type="checkbox"
                role="switch" :disabled="disabled">
        </span>
    </label>
</template>

<style scoped>
.transit-card {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 12px 14px;
    border: 1px solid var(--theme-purple-border, #D9CFF8);
    border-radius: 12px;
    background: var(--theme-page, #F7F4FE);
    cursor: pointer;
}

.transit-card.is-disabled {
    border-color: var(--theme-border, #E5E7EB);
    background: var(--theme-page, #FBFBF7);
    cursor: not-allowed;
}

.transit-icon {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--theme-panel, white);
    color: var(--theme-purple, #4B3B8F);
}

.is-disabled .transit-icon {
    color: var(--theme-muted, #9CA3AF);
}

.transit-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 14px;
    color: var(--theme-text, #2F2F2F);
}

.transit-text small {
    font-size: 12px;
    color: var(--theme-muted, #6B7280);
}

.is-disabled .transit-text {
    color: var(--theme-muted, #6B7280);
}

.transit-switch {
    width: 40px;
    height: 22px;
    margin: 0;
    cursor: inherit;
}

.transit-switch:checked {
    border-color: var(--theme-accent-border, #2F7A3F);
    background-color: #2F7A3F;
}

.transit-switch:focus {
    border-color: var(--theme-accent-border, #A8D5B5);
    box-shadow: 0 0 0 3px #E8F5E9;
}

.transit-switch:disabled {
    opacity: 1;
    background-color: var(--theme-neutral, #D1D5DB);
    border-color: var(--theme-border, #D1D5DB);
}
</style>
