<script setup>
// Owner: Chaithra (E). Matches Figma "Mobile prototype" → "16 · Transit mode".
// Phone layout of Transit mode. TransitView loads the data and does the posting;
// this component only shows it and sends events back.
import { ref, computed } from 'vue'
import { formatTime } from '../../my-tasks/utils/formatters.js'
import OneMapTiles from './OneMapTiles.vue'
import PersonAvatar from '../../my-tasks/components/PersonAvatar.vue'
import { WORDS, TRIP_STEPS, extraUpdates } from '../utils/wording.js'

const props = defineProps({
    task: { type: Object, required: true },
    session: { type: Object, default: null },
    who: { type: String, default: '' },
    companionFirst: { type: String, default: '' },
    isCompanion: { type: Boolean, default: false },
    canStart: { type: Boolean, default: false },
    isPosting: { type: Boolean, default: false },
    actionError: { type: String, default: '' },
    notice: { type: String, default: '' },
    liveSpot: { type: Object, default: null },    // { lat, lng, at } while the trip is live
    locationNote: { type: String, default: '' },  // companion only: "Sharing your location…"
    liveCaption: { type: String, default: '' },   // "Live · updated 1:42 PM" or "Location paused · …"
    canResume: { type: Boolean, default: false }, // companion, after an accidental End transit
    liveTime: { type: String, default: '' },       // photo-pin bubble: "12:25 AM Tue"
    liveNote: { type: String, default: '' },       // photo-pin bubble: "Heading home"
    otherTrips: { type: Array, default: () => [] } // other family members on a trip right now
})
const emit = defineEmits(['back', 'post', 'start', 'dismiss', 'resume', 'open-trip', 'remove'])

// The fixed steps in order, with the labels used on the phone design
// Same steps and quick updates as the laptop layout (utils/wording.js)
const PRESETS = TRIP_STEPS
const EXTRA_CHIPS = computed(() => extraUpdates(props.who))

const customText = ref('')

const milestones = computed(() => props.session?.milestones || [])
const isActive = computed(() => props.session?.status === 'active')
const isEnded = computed(() => props.session?.status === 'ended')
const trail = computed(() => props.session?.path || [])
const hasPlace = computed(() => Number.isFinite(props.task.location?.lat) && Number.isFinite(props.task.location?.lng))
const placeName = computed(() => props.task.location?.name || 'the clinic')

// Done steps (as posted) followed by the preset steps still to come
const steps = computed(() => {
    const done = milestones.value.map((m) => ({ ...m, done: true }))
    const lastPreset = Math.max(-1, ...milestones.value.map((m) => PRESETS.findIndex((p) => p.type === m.type)))
    const todo = isEnded.value ? [] : PRESETS.slice(lastPreset + 1).map((p) => ({ ...p, done: false }))
    return [...done, ...todo]
})
const currentIndex = computed(() => milestones.value.length - 1)
const nextIndex = computed(() => steps.value.findIndex((s) => !s.done))

// Four chips: the next preset step (highlighted), two common custom ones, then later steps
const chips = computed(() => {
    const posted = new Set(milestones.value.map((m) => m.label.toLowerCase()))
    const upcoming = steps.value.filter((s) => !s.done && s.type !== 'home')
    const list = []
    if (upcoming[0]) list.push({ type: upcoming[0].type, label: upcoming[0].label, suggested: true })
    for (const label of EXTRA_CHIPS.value) {
        if (!posted.has(label.toLowerCase())) list.push({ type: 'custom', label })
    }
    for (const step of upcoming.slice(1)) list.push({ type: step.type, label: step.label })
    return list.slice(0, 4)
})

const subtitle = computed(() => {
    if (!props.session) return 'Transit not started yet'
    const withWho = props.who ? `With ${props.who}` : props.companionFirst ? `With ${props.companionFirst}` : ''
    return [withWho, isActive.value ? 'family can see this live' : 'trip ended'].filter(Boolean).join(' · ')
})

const time = (value) => formatTime(value).toUpperCase().replace(/(AM|PM)$/, ' $1')

function postChip(chip) {
    emit('post', { type: chip.type, label: chip.label })
}

function postCustom() {
    const label = customText.value.trim()
    if (!label) return
    emit('post', { type: 'custom', label })
    customText.value = ''
}

function safelyHome() {
    if (window.confirm(`Is ${props.who || 'everyone'} safely back home? This finishes the task and tells the family.`)) {
        emit('post', { type: 'home', label: WORDS.safelyHome })
    }
}
</script>

<template>
    <div class="m-transit">
        <!-- Green header -->
        <header class="bar">
            <button type="button" class="back" aria-label="Back" @click="emit('back')">
                <i class="bi bi-chevron-left" aria-hidden="true"></i>
            </button>
            <div class="bar-text">
                <strong>{{ task.title }}</strong>
                <span>{{ subtitle }}</span>
            </div>
            <span v-if="isActive" class="live">{{ WORDS.live }}</span>
            <span v-else-if="isEnded" class="live ended">{{ WORDS.ended }}</span>
        </header>

        <div v-if="otherTrips.length" class="also-live body">
            <span>{{ WORDS.alsoOnTrip }}</span>
            <button v-for="trip in otherTrips" :key="trip.taskId" type="button" class="also-live-chip" @click="emit('open-trip', trip)">
                <PersonAvatar :name="trip.companion?.name || ''" :size="24" tone="peach" />
                {{ (trip.companion?.name || 'Someone').split(' ')[0] }} · {{ trip.mobileHeadline }}
                <span class="also-live-dot" aria-hidden="true"></span>
            </button>
        </div>

        <div v-if="notice" class="msg" role="status" @click="emit('dismiss')">{{ notice }}</div>
        <div v-if="actionError" class="msg is-error" role="alert">{{ actionError }}</div>

        <!-- Not started -->
        <div v-if="!session" class="body">
            <p class="hint">Transit starts when {{ companionFirst || 'the person who claimed this task' }} taps "{{ WORDS.startTrip }}".</p>
            <button v-if="canStart" type="button" class="btn-start" :disabled="isPosting" @click="emit('start')">
                <i class="bi bi-arrow-right" aria-hidden="true"></i> {{ WORDS.startTrip }}
            </button>
        </div>

        <template v-else>
            <!-- Map: always on a trip with a place (the clinic pin), plus the person once they share location -->
            <section v-if="liveSpot || trail.length > 1 || hasPlace" class="live-map body" aria-label="Live map">
                <OneMapTiles
                    :lat="task.location?.lat ?? null"
                    :lng="task.location?.lng ?? null"
                    :live-lat="liveSpot?.lat ?? null"
                    :live-lng="liveSpot?.lng ?? null"
                    :live-label="companionFirst"
                    :trail="trail"
                    :live-time="liveTime"
                    :live-note="liveNote"
                    :label="liveSpot ? (liveCaption || `Live · updated ${time(liveSpot.at)}`) : trail.length > 1 ? 'Route travelled' : (task.location?.name || 'Destination')"
                    :height="260"
                    :fit-width="320"
                />
            </section>

            <!-- Checklist -->
            <ol class="steps body" aria-label="Trip progress">
                <li
                    v-for="(step, index) in steps"
                    :key="step.done ? `${step.type}-${step.at}` : step.type"
                    :class="{ done: step.done, current: index === currentIndex, after: index > currentIndex }"
                >
                    <span class="rail" aria-hidden="true"><span class="dot"></span><span class="line"></span></span>
                    <span class="step-text">
                        <strong>{{ step.type === 'arrived' && step.done && step.label === 'Arrived at clinic' ? `Arrived at ${placeName}` : step.label }}</strong>
                        <small v-if="step.done">{{ time(step.at) }}</small>
                        <small v-else-if="index === nextIndex && isActive">Next</small>
                    </span>
                    <button
                        v-if="step.done && isCompanion && step.type !== 'home'"
                        type="button"
                        class="remove-step"
                        :disabled="isPosting"
                        :aria-label="`Remove ${step.label}`"
                        @click="emit('remove', step)"
                    >
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </li>
            </ol>

            <!-- Companion: post the next update -->
            <section v-if="isActive && isCompanion" class="post body" aria-labelledby="m-post-title">
                <h2 id="m-post-title">Post the next update</h2>
                <div class="chips">
                    <button
                        v-for="chip in chips"
                        :key="`${chip.type}-${chip.label}`"
                        type="button"
                        class="chip"
                        :class="{ suggested: chip.suggested }"
                        :disabled="isPosting"
                        @click="postChip(chip)"
                    >
                        {{ chip.label }}
                    </button>
                </div>
                <form class="own" @submit.prevent="postCustom">
                    <input v-model="customText" type="text" maxlength="80" placeholder="Or type your own update" aria-label="Your own update" />
                    <button type="submit" class="send" :disabled="isPosting || !customText.trim()" aria-label="Post update">
                        <i class="bi bi-arrow-right" aria-hidden="true"></i>
                    </button>
                </form>
                <p v-if="locationNote" class="location-note">{{ locationNote }}</p>
            </section>

            <p v-else-if="isActive" class="hint body">
                You're following live. Only {{ companionFirst || 'the companion' }} can post updates.
            </p>
            <p v-else-if="isEnded" class="hint body done-note">
                {{ task.status === 'completed' ? `${who || 'Everyone'} is safely back home. The task is done.` : WORDS.tripEnded }}
            </p>
            <div v-if="canResume" class="body">
                <button type="button" class="btn-resume" :disabled="isPosting" @click="emit('resume')">
                    <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i> {{ WORDS.resumeTrip }}
                </button>
            </div>
        </template>

        <!-- F (SeungHak): "Notes from this visit" (consultation notes), filled in by TransitView -->
        <div v-if="$slots.notes && task" class="visit-notes body">
            <slot name="notes" />
        </div>

        <!-- Bottom: finish the trip -->
        <footer v-if="isActive && isCompanion" class="footer">
            <button type="button" class="btn-home" :disabled="isPosting" @click="safelyHome">
                <i class="bi bi-house" aria-hidden="true"></i>
                {{ who || 'Everyone' }} is safely back home
            </button>
            <small>This finishes the task and tells the family.</small>
        </footer>
    </div>
</template>

<style scoped>
.visit-notes {
    padding: 14px 16px;
    border: 1px solid var(--theme-border, #e4ece5);
    border-radius: 18px;
    background: var(--theme-panel, #fff);
}

/* Other family members on a trip right now */
.also-live {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--theme-muted, #6b7280);
}

.also-live-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px 4px 4px;
    border: 1px solid var(--theme-accent-border, #cfe8d3);
    border-radius: 999px;
    background: var(--theme-soft, #e8f5e9);
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: var(--theme-text, #2e2e2e);
    cursor: pointer;
}

.also-live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e46f5c;
}

.live-map {
    margin-top: 12px;
}

.btn-resume {
    width: 100%;
    margin-top: 4px;
    padding: 14px;
    border: 1.5px solid var(--theme-accent-border, #2f7a3f);
    border-radius: 14px;
    background: var(--theme-panel, white);
    font-family: inherit;
    font-size: 16px;
    font-weight: 800;
    color: var(--theme-green, #2f7a3f);
}

.location-note {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--theme-muted, #5b6470);
}

/* Values from Figma "Mobile prototype" → 16 · Transit mode (390 × 844) */
.m-transit {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 120px);
    margin: 0 -18px; /* layout has 18px side padding on phones */
    background: var(--theme-page, #fbfbf7);
    font-family: Nunito, Inter, system-ui, sans-serif;
    color: var(--theme-text, #2e2e2e);
}

.body {
    padding-left: 20px;
    padding-right: 20px;
}

.bar {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 60px;
    padding: 0 16px 0 18px;
    background: var(--theme-green, #2f7a3f);
}

.back {
    border: none;
    background: none;
    color: white;
    font-size: 20px;
}

.bar-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.bar-text strong {
    font-size: 17px;
    font-weight: 700;
    color: white;
}

.bar-text span {
    overflow: hidden;
    font-size: 13px;
    color: var(--theme-green, #d7ebd9);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.live {
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 12px;
    background: var(--theme-panel, white);
    font-size: 12px;
    font-weight: 900;
    color: var(--theme-green, #1f5a2c);
}

.live.ended {
    color: var(--theme-muted, #5b6470);
}

.msg {
    margin: 12px 20px 0;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--theme-warning-soft, #fff6e0);
    font-size: 14px;
    color: var(--theme-warning, #7a4b00);
}

.msg.is-error {
    background: var(--theme-danger-soft, #ffe9e4);
    color: var(--theme-danger, #9f3a2b);
}

/* Checklist */
.steps {
    margin: 18px 0 0;
    padding-top: 0;
    list-style: none;
}

.steps li {
    display: flex;
    gap: 17px;
    min-height: 58px;
}

.steps li:last-child {
    min-height: 40px;
}

.rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 22px;
}

.dot {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    border: 2px solid var(--theme-border, #c9d1c9);
    border-radius: 50%;
    background: var(--theme-panel, white);
}

.done .dot {
    border: none;
    background: var(--theme-green, #2f7a3f);
}

.current .dot {
    width: 22px;
    height: 22px;
    border: 6px solid var(--theme-accent-border, #b8ddbe);
    background: var(--theme-green, #2f7a3f);
}

.line {
    flex: 1;
    width: 2px;
    background: var(--theme-green, #2f7a3f);
}

.current .line,
.after .line {
    background: var(--theme-neutral, #dce3dc);
}

.steps li:last-child .line {
    display: none;
}

.remove-step {
    align-self: flex-start;
    margin-left: auto;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--theme-muted, #6b7280);
}

.remove-step:active:not(:disabled) {
    background: #ffe9e4;
    color: #a33a26;
}

.step-text {
    display: flex;
    flex-direction: column;
}

.step-text strong {
    font-size: 15px;
    font-weight: 700;
    color: var(--theme-muted, #5b6470);
}

.done .step-text strong {
    font-weight: 800;
    color: var(--theme-text, #2e2e2e);
}

.step-text small {
    font-size: 13px;
    color: var(--theme-muted, #5b6470);
}

/* Post the next update */
.post {
    margin-top: 28px;
    margin-bottom: 24px;
}

h2 {
    margin: 0 0 14px;
    font-size: 15px;
    font-weight: 800;
    color: var(--theme-text, #2e2e2e);
}

.chips {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.chip {
    height: 52px;
    padding: 0 8px;
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 14px;
    background: var(--theme-panel, white);
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    color: var(--theme-text, #2e2e2e);
}

.chip.suggested {
    border: 2px solid var(--theme-accent-border, #2f7a3f);
    background: var(--theme-soft, #e8f5e9);
    font-weight: 800;
}

.own {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.own input {
    flex: 1;
    min-width: 0;
    height: 50px;
    padding: 0 15px;
    border: 1px solid var(--theme-border, #dce3dc);
    border-radius: 14px;
    background: var(--theme-panel, white);
    font-family: inherit;
    font-size: 15px;
    color: var(--theme-text, #2e2e2e);
}

.own input::placeholder {
    color: var(--theme-muted, #8a9099);
}

.send {
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 14px;
    background: var(--theme-text, #2e2e2e);
    color: white;
    font-size: 20px;
}

.hint {
    margin: 20px 0 0;
    font-size: 14px;
    color: var(--theme-muted, #5b6470);
}

.done-note {
    font-weight: 700;
    color: var(--theme-green, #1f5a2c);
}

.btn-start {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 52px;
    margin-top: 16px;
    border: none;
    border-radius: 14px;
    background: var(--theme-green, #2f7a3f);
    font-family: inherit;
    font-size: 16px;
    font-weight: 800;
    color: white;
}

/* Bottom bar */
.footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: auto;
    padding: 13px 20px 20px;
    border-top: 1px solid var(--theme-border, #e5e7eb);
    background: var(--theme-panel, white);
}

.btn-home {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 56px;
    border: none;
    border-radius: 16px;
    background: #f28b7a;
    font-family: inherit;
    font-size: 17px;
    font-weight: 900;
    color: var(--theme-text, #2e2e2e);
}

.footer small {
    font-size: 13px;
    color: var(--theme-muted, #5b6470);
}

button:disabled {
    opacity: 0.6;
}
</style>
