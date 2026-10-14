<script setup>
// Owner: Chaithra (E)
// "Your week" (Figma frame 10): Monday to Sunday, today highlighted, a dot on days with tasks.
import { computed } from 'vue'
import { dayKey, TIME_ZONE } from '../utils/formatters.js'

const props = defineProps({
    tasks: { type: Array, default: () => [] },
    now: { type: Number, default: () => Date.now() }
})

const DAY_MS = 24 * 60 * 60 * 1000

const days = computed(() => {
    const todayKey = dayKey(props.now)
    const weekday = new Date(props.now).toLocaleDateString('en-US', { weekday: 'short', timeZone: TIME_ZONE })
    const offset = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday)
    const busyDays = new Set(props.tasks.map((t) => dayKey(t.startAt)))

    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(props.now + (i - offset) * DAY_MS)
        const key = dayKey(date)
        return {
            key,
            letter: date.toLocaleDateString('en-SG', { weekday: 'narrow', timeZone: TIME_ZONE }),
            number: date.toLocaleDateString('en-SG', { day: 'numeric', timeZone: TIME_ZONE }),
            isToday: key === todayKey,
            hasTasks: busyDays.has(key)
        }
    })
})
</script>

<template>
    <section class="week-card" aria-labelledby="week-title">
        <h2 id="week-title">Your week</h2>
        <ol class="week">
            <li v-for="day in days" :key="day.key" :class="{ today: day.isToday }">
                <span class="letter">{{ day.letter }}</span>
                <span class="number">{{ day.number }}</span>
                <span class="dot" :class="{ on: day.hasTasks }"></span>
                <span v-if="day.hasTasks" class="visually-hidden">has tasks</span>
            </li>
        </ol>
    </section>
</template>

<style scoped>
.week-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    background: white;
}

h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.09px;
    font-weight: 600;
    color: #2e2e2e;
}

.week {
    display: flex;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
}

li {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
    border-radius: 10px;
}

.letter {
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    color: #6b7280;
}

.number {
    font-size: 14px;
    line-height: 20px;
    font-weight: 700;
    color: #2e2e2e;
}

.today {
    background: #2f7a3f;
}

.today .letter,
.today .number {
    color: white;
}

.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}

.dot.on {
    background: #6dbf7c;
}
</style>
