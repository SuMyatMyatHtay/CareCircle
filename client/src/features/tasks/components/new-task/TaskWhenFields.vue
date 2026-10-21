<script setup>
// Owner: Marcus (D)
// "When?": quick date chips (Today, Tomorrow, the day after, Pick a date…) and start / end times.
//   <TaskWhenFields v-model:date="form.date.value" v-model:start-time="..." v-model:end-time="..." />
import { ref, computed, useId } from 'vue'
import { quickDates, dateLabel, todayKey } from '../../composables/useTaskForm.js'

defineProps({
    startError: { type: String, default: '' },
    endError: { type: String, default: '' }
})

const date = defineModel('date', { type: String, default: '' })
const startTime = defineModel('startTime', { type: String, default: '' })
const endTime = defineModel('endTime', { type: String, default: '' })

const id = useId()
const chips = quickDates()
const isQuickDate = computed(() => chips.some((chip) => chip.value === date.value))
// The date input shows when asked for, or when the date isn't one of the chips
const picking = ref(false)
const showPicker = computed(() => picking.value || (date.value && !isQuickDate.value))

function pickQuick(value) {
    date.value = value
    picking.value = false
}
</script>

<template>
    <fieldset class="task-field">
        <legend class="task-label">When?</legend>

        <div class="date-chips">
            <button v-for="chip in chips" :key="chip.value" type="button" class="date-chip"
                :class="{ selected: date === chip.value && !picking }" :aria-pressed="date === chip.value && !picking"
                @click="pickQuick(chip.value)">
                {{ chip.label }}
            </button>
            <button type="button" class="date-chip" :class="{ selected: showPicker }" :aria-pressed="showPicker"
                @click="picking = true">
                {{ showPicker && date && !isQuickDate ? dateLabel(date) : 'Pick a date…' }}
            </button>
        </div>

        <div v-if="showPicker" class="mt-2">
            <label class="task-sublabel" :for="`${id}-date`">Date</label>
            <input :id="`${id}-date`" v-model="date" type="date" class="task-input" :min="todayKey()">
        </div>

        <div class="time-row">
            <div>
                <label class="task-sublabel" :for="`${id}-start`">Starts</label>
                <input :id="`${id}-start`" v-model="startTime" type="time" class="task-input"
                    :class="{ 'is-invalid': startError }" :aria-describedby="startError ? `${id}-start-error` : null">
                <p v-if="startError" :id="`${id}-start-error`" class="task-field-error">{{ startError }}</p>
            </div>
            <div>
                <label class="task-sublabel" :for="`${id}-end`">Ends (optional)</label>
                <input :id="`${id}-end`" v-model="endTime" type="time" class="task-input"
                    :class="{ 'is-invalid': endError }" :aria-describedby="endError ? `${id}-end-error` : null">
                <p v-if="endError" :id="`${id}-end-error`" class="task-field-error">{{ endError }}</p>
            </div>
        </div>
    </fieldset>
</template>

<style scoped>
.date-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.date-chip {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--theme-border, #E5E7EB);
    border-radius: 999px;
    background: var(--theme-panel, white);
    color: var(--theme-text, #2F2F2F);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
}

.date-chip:hover {
    background: var(--theme-page, #F7FAF7);
}

.date-chip.selected {
    border-color: var(--theme-accent-border, #2F7A3F);
    background: #2F7A3F;
    color: white;
    font-weight: 600;
}

.date-chip:focus-visible {
    outline: 3px solid var(--theme-accent-border, #A8D5B5);
    outline-offset: 2px;
}

.time-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 10px;
}
</style>
