<script setup>
// One row in a task list: date, recipient, title, time/place, who claimed it, status.
// Buttons (e.g. "I'll take it") can be passed in through the "actions" slot.
import { computed } from 'vue'
import TaskStatusBadge from './TaskStatusBadge.vue'

const props = defineProps({
    task: { type: Object, required: true }
})

// The API sends UTC; show it in Singapore time
const TIME_ZONE = 'Asia/Singapore'
const startAt = computed(() => new Date(props.task.startAt))

const weekday = computed(() =>
    startAt.value.toLocaleDateString('en-SG', { weekday: 'short', timeZone: TIME_ZONE }).toUpperCase()
)

const dayOfMonth = computed(() =>
    startAt.value.toLocaleDateString('en-SG', { day: 'numeric', timeZone: TIME_ZONE })
)

const time = computed(() =>
    startAt.value
        .toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIME_ZONE })
        .replace(' ', '')
)

const place = computed(() =>
    props.task.location?.name || props.task.location?.address || ''
)

const isOpen = computed(() => props.task.status === 'open')
const isClosed = computed(() => ['completed', 'cancelled'].includes(props.task.status))

// recipient is null for household tasks, and only an id until recipients are populated
const recipientName = computed(() => {
    const recipient = props.task.recipient
    return typeof recipient === 'object' && recipient
        ? recipient.nickname || recipient.name
        : ''
})

function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
</script>

<template>
    <article class="task-item" :class="{ 'is-open': isOpen, 'is-closed': isClosed }">
        <div class="date-badge" :aria-label="`${weekday} ${dayOfMonth}`">
            <span class="date-weekday">{{ weekday }}</span>
            <span class="date-day">{{ dayOfMonth }}</span>
        </div>

        <div class="recipient-avatar" :title="recipientName || 'Household task'">
            <template v-if="recipientName">{{ initials(recipientName) }}</template>
            <i v-else class="bi bi-house-heart" aria-hidden="true"></i>
        </div>

        <div class="task-text">
            <h3 class="task-title">{{ task.title }}</h3>
            <p class="task-meta">
                {{ time }}<template v-if="place"> · {{ place }}</template>
                <template v-if="recipientName"> · for {{ recipientName }}</template>
            </p>
        </div>

        <div class="task-side">
            <span v-if="task.claimedBy" class="claimer">
                <span class="claimer-avatar">{{ initials(task.claimedBy.name) }}</span>
                {{ task.claimedBy.name }}
            </span>

            <TaskStatusBadge :status="task.status" :needs-transit="task.needsTransit" />

            <slot name="actions" :task="task"></slot>
        </div>
    </article>
</template>

<style scoped>
.task-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    background: white;
    border: 1px solid #E4ECE5;
    border-radius: 14px;
}

.task-item.is-open {
    border-color: #FFDAD0;
}

.task-item.is-closed {
    opacity: 0.65;
}

.date-badge {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
    border-radius: 10px;
    background: #E8F5E9;
    color: #2E7D43;
    line-height: 1.1;
}

.is-open .date-badge {
    background: #FFF0EB;
    color: #C0564B;
}

.date-weekday {
    font-size: 11px;
    font-weight: 800;
}

.date-day {
    font-size: 19px;
    font-weight: 800;
}

.recipient-avatar,
.claimer-avatar {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #FDF3E4;
    color: #A0703A;
    font-weight: 800;
}

.recipient-avatar {
    width: 36px;
    height: 36px;
    font-size: 13px;
}

.recipient-avatar .bi {
    font-size: 17px;
}

.task-text {
    flex: 1;
    min-width: 0;
}

.task-title {
    margin: 0 0 3px;
    font-size: 16px;
    font-weight: 700;
    color: #2F2F2F;
}

.task-meta {
    margin: 0;
    font-size: 14px;
    color: #7B8391;
}

.task-side {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 12px;
}

.claimer {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 14px;
    color: #2F2F2F;
}

.claimer-avatar {
    width: 24px;
    height: 24px;
    font-size: 10px;
    background: #E8F5E9;
    color: #2E7D43;
}

@media (max-width: 575px) {
    .task-item {
        flex-wrap: wrap;
    }

    .task-side {
        width: 100%;
        justify-content: flex-start;
        padding-left: 66px;
    }
}
</style>
