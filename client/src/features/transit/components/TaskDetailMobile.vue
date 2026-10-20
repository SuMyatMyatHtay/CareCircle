<script setup>
// Matches Figma "Mobile prototype" → "09 · Task detail" (D · Task Management + E).
// Phone layout of the Task detail page. TaskDetailView loads the task and runs the actions.
// E parts here: Start the trip / Open the trip, live trip status, Open in Maps, Add to calendar.
import { ref, computed, watch } from 'vue'
import PersonAvatar from '../../my-tasks/components/PersonAvatar.vue'
import { getTransitSession } from '../services/transitApi.js'
import { formatTime, recipientName, TIME_ZONE } from '../../my-tasks/utils/formatters.js'
import AddToCalendar from './AddToCalendar.vue'

const props = defineProps({
    task: { type: Object, required: true },
    familyId: { type: String, required: true },
    isClaimer: { type: Boolean, default: false },
    isBusy: { type: Boolean, default: false },
    notice: { type: String, default: '' },
    actionError: { type: String, default: '' }
})
const emit = defineEmits(['back', 'start', 'open-trip', 'complete', 'unclaim', 'claim', 'edit', 'delete', 'dismiss'])

const CATEGORY_LABELS = {
    appointment: 'Appointment', therapy: 'Therapy', errand: 'Errand', groceries: 'Groceries',
    childcare: 'Childcare', medication: 'Medication', companionship: 'Companionship', other: 'Other'
}

const session = ref(null)
const menuOpen = ref(false)
const calendarOpen = ref(false)

const who = computed(() => recipientName(props.task))
const status = computed(() => props.task.status)
const claimerName = computed(() => props.task.claimedBy?.name || '')
const claimerFirst = computed(() => claimerName.value.split(' ')[0])
const creatorName = computed(() => props.task.createdBy?.name || 'someone')
const latest = computed(() => {
    const steps = session.value?.milestones || []
    return steps[steps.length - 1] || null
})
const isLive = computed(() => session.value?.status === 'active')

const time = (value) => formatTime(value).toUpperCase().replace(/(AM|PM)$/, ' $1')
const day = (value, opts) => new Date(value).toLocaleDateString('en-GB', { timeZone: TIME_ZONE, ...opts })

// "Wed 14 Oct, 10:00 – 11:30 AM"
const whenText = computed(() => {
    const start = time(props.task.startAt)
    const end = props.task.endAt ? time(props.task.endAt) : ''
    const range = end
        ? `${start.replace(/ (AM|PM)$/, start.slice(-2) === end.slice(-2) ? '' : ' $1')} – ${end}`
        : start
    return `${day(props.task.startAt, { weekday: 'short', day: 'numeric', month: 'short' })}, ${range}`
})
// Trips: suggest leaving 30 minutes early
const leaveBy = computed(() =>
    props.task.needsTransit ? `Leave home by ${time(new Date(props.task.startAt).getTime() - 30 * 60 * 1000)}` : ''
)
const addressLine = computed(() => {
    const loc = props.task.location
    if (!loc) return ''
    return [loc.address, loc.postal].filter(Boolean).join(', ')
})
const mapsUrl = computed(() => {
    const loc = props.task.location
    if (!loc) return ''
    const target = Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
        ? `${loc.lat},${loc.lng}`
        : [loc.name, loc.address].filter(Boolean).join(' ')
    return target ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}` : ''
})

// Segmented progress: Claimed / In progress / Done
const progress = computed(() => {
    const reached = { claimed: 0, in_progress: 1, completed: 2 }[status.value] ?? -1
    return ['Claimed', 'In progress', 'Done'].map((label, i) => ({ label, on: i <= reached }))
})

// Main green button
const mainButton = computed(() => {
    if (status.value === 'open') return { label: "I'll take it", event: 'claim', icon: 'bi-hand-thumbs-up' }
    if (props.task.needsTransit && props.isClaimer && status.value === 'claimed') {
        return { label: 'Start the trip', event: 'start', icon: 'bi-arrow-right' }
    }
    if (props.task.needsTransit && session.value) {
        return { label: isLive.value ? 'Open the trip' : 'View journey', event: 'open-trip', icon: 'bi-geo-alt' }
    }
    return null
})

async function loadSession() {
    if (!props.task.needsTransit) {
        session.value = null
        return
    }
    try {
        session.value = await getTransitSession(props.familyId, props.task._id)
    } catch {
        session.value = null
    }
}
watch(() => [props.task._id, props.task.status], loadSession, { immediate: true })
</script>

<template>
    <div class="m-detail">
        <div class="top">
            <button type="button" class="icon-btn" aria-label="Back" @click="emit('back')">
                <i class="bi bi-chevron-left" aria-hidden="true"></i>
            </button>
            <div class="menu-wrap">
                <button type="button" class="icon-btn" aria-label="More" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
                    <i class="bi bi-three-dots" aria-hidden="true"></i>
                </button>
                <div v-if="menuOpen" class="menu" @click="menuOpen = false">
                    <button type="button" @click="calendarOpen = true">Add to calendar</button>
                    <button type="button" @click="emit('edit')">Edit</button>
                    <button type="button" class="danger" @click="emit('delete')">Delete</button>
                </div>
            </div>
        </div>

        <header class="head">
            <PersonAvatar :name="who" :size="56" />
            <div>
                <span class="for">For {{ who || 'the household' }} · {{ CATEGORY_LABELS[task.category] || 'Task' }}</span>
                <h1>{{ task.title }}</h1>
            </div>
        </header>

        <ol class="m-progress" aria-label="Progress">
            <li v-for="seg in progress" :key="seg.label" :class="{ on: seg.on }">
                <span class="seg"></span>
                <span class="seg-label">{{ seg.label }}</span>
            </li>
        </ol>

        <div v-if="notice" class="msg" role="status" @click="emit('dismiss')">{{ notice }}</div>
        <div v-if="actionError" class="msg is-error" role="alert">{{ actionError }}</div>

        <!-- Live trip status (while someone is in transit) -->
        <button v-if="session && latest" type="button" class="live" @click="emit('open-trip')">
            <span class="live-pill">{{ isLive ? 'LIVE' : 'ENDED' }}</span>
            <span class="live-text">
                <strong>{{ latest.label }}</strong>
                <small>{{ time(latest.at) }}{{ isLive ? ' · tap to update' : '' }}</small>
            </span>
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </button>

        <section class="info">
            <div class="info-row">
                <i class="bi bi-clock" aria-hidden="true"></i>
                <div>
                    <strong>{{ whenText }}</strong>
                    <small v-if="leaveBy">{{ leaveBy }}</small>
                    <button type="button" class="link" @click="calendarOpen = true">Add to calendar</button>
                </div>
            </div>
            <div v-if="task.location" class="info-row">
                <i class="bi bi-geo-alt" aria-hidden="true"></i>
                <div>
                    <strong>{{ task.location.name || task.location.address }}</strong>
                    <small v-if="addressLine && task.location.name">{{ addressLine }}</small>
                    <a v-if="mapsUrl" :href="mapsUrl" target="_blank" rel="noopener" class="link">Open in Maps</a>
                </div>
            </div>
            <div class="info-row person">
                <PersonAvatar :name="claimerName" :size="32" tone="peach" />
                <div>
                    <strong>{{ claimerFirst ? `${claimerFirst} is taking this` : 'Nobody has taken this yet' }}</strong>
                    <small>Posted by {{ creatorName }} · {{ day(task.createdAt, { weekday: 'short' }) }}</small>
                </div>
            </div>
        </section>

        <section v-if="task.description" class="notes">
            <strong>Notes</strong>
            <p>{{ task.description }}</p>
        </section>

        <footer v-if="mainButton || (isClaimer && ['claimed', 'in_progress'].includes(status))" class="footer">
            <button v-if="mainButton" type="button" class="btn-main" :disabled="isBusy" @click="emit(mainButton.event)">
                <i class="bi" :class="mainButton.icon" aria-hidden="true"></i> {{ mainButton.label }}
            </button>
            <div v-if="isClaimer && ['claimed', 'in_progress'].includes(status)" class="pair">
                <button type="button" class="btn-plain" :disabled="isBusy" @click="emit('complete')">Mark as done</button>
                <button v-if="status === 'claimed'" type="button" class="btn-plain danger" :disabled="isBusy" @click="emit('unclaim')">
                    Unclaim
                </button>
            </div>
        </footer>

        <AddToCalendar v-model="calendarOpen" :tasks="[task]" />
    </div>
</template>

<style scoped>
/* Values from Figma "Mobile prototype" → 09 · Task detail (390 × 844) */
.m-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: calc(100vh - 140px);
    font-family: Nunito, Inter, system-ui, sans-serif;
    color: #2e2e2e;
}

.top {
    display: flex;
    justify-content: space-between;
}

.icon-btn {
    padding: 0;
    border: none;
    background: none;
    font-size: 22px;
    color: #2e2e2e;
}

.menu-wrap {
    position: relative;
}

.menu {
    position: absolute;
    right: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: white;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

.menu a,
.menu button {
    padding: 12px 16px;
    border: none;
    background: white;
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    color: #2e2e2e;
    text-align: left;
    text-decoration: none;
}

.menu .danger {
    color: #9f3a2b;
}

.head {
    display: flex;
    align-items: center;
    gap: 12px;
}

.for {
    font-size: 14px;
    font-weight: 700;
    color: #5b6470;
}

h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 900;
    color: #2e2e2e;
}

.m-progress {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.seg {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: #dce3dc;
}

.on .seg {
    background: #2f7a3f;
}

.seg-label {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #5b6470;
}

.on .seg-label {
    font-weight: 800;
    color: #1f5a2c;
}

.msg {
    padding: 10px 14px;
    border-radius: 14px;
    background: #fff6e0;
    font-size: 14px;
    color: #7a4b00;
}

.msg.is-error {
    background: #ffe9e4;
    color: #9f3a2b;
}

.live {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: none;
    border-radius: 18px;
    background: #e8f5e9;
    font-family: inherit;
    text-align: left;
    color: #1f5a2c;
}

.live-pill {
    padding: 3px 10px;
    border-radius: 12px;
    background: #2f7a3f;
    font-size: 12px;
    font-weight: 900;
    color: white;
}

.live-text {
    display: flex;
    flex: 1;
    flex-direction: column;
}

.live-text strong {
    font-size: 15px;
    font-weight: 800;
    color: #2e2e2e;
}

.live-text small {
    font-size: 13px;
    color: #5b6470;
}

.info {
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    background: white;
}

.info-row {
    display: flex;
    gap: 12px;
    padding: 15px 16px;
}

.info-row + .info-row {
    border-top: 1px solid #f0f1f3;
}

.info-row > .bi {
    font-size: 20px;
    color: #2f7a3f;
}

.info-row div {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.info-row strong {
    font-size: 15px;
    font-weight: 700;
}

.info-row small {
    font-size: 13px;
    color: #5b6470;
}

.link {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: none;
    font-family: inherit;
    margin-top: 4px;
    font-size: 14px;
    font-weight: 800;
    color: #2f7a3f;
    text-decoration: none;
}

.person {
    align-items: center;
}

.notes {
    padding: 14px 16px;
    border-radius: 18px;
    background: #fff6e0;
}

.notes strong {
    font-size: 14px;
    font-weight: 700;
}

.notes p {
    margin: 6px 0 0;
    font-size: 15px;
    line-height: 21.75px;
}

.footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: auto -18px 0; /* full width under the 18px layout padding */
    padding: 13px 20px 20px;
    border-top: 1px solid #e5e7eb;
    background: white;
}

.btn-main {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 52px;
    border: none;
    border-radius: 14px;
    background: #2f7a3f;
    font-family: inherit;
    font-size: 16px;
    font-weight: 800;
    color: white;
}

.pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

/* Only "Mark as done" (no Unclaim once a trip has started): use the full width */
.pair > :only-child {
    grid-column: 1 / -1;
}

.btn-plain {
    height: 48px;
    border: 1px solid #dce3dc;
    border-radius: 14px;
    background: white;
    font-family: inherit;
    font-size: 15px;
    font-weight: 800;
    color: #2e2e2e;
}

.btn-plain.danger {
    border-color: #f6c9bf;
    color: #9f3a2b;
}

button:disabled {
    opacity: 0.6;
}
</style>
