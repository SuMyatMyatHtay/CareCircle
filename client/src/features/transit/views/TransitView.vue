<script setup>
// Owner: Chaithra (E). Matches Figma frame "06 · Transit mode" (CareCircle Wireframe). CC-14 + CC-19.
// Route: /transit/:familyId/:taskId
// - The companion (who claimed the task) posts each step: a preset chip or their own text.
// - Every step is saved with the time it was posted (the server sets the time).
// - Everyone else in the family sees the same timeline, refreshed every 10 seconds.
// - "Safely back home" ends the trip and completes the task (done on the server).
// - "End transit" stops the trip without completing the task.
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import ClinicSearch from '../components/ClinicSearch.vue'
import OneMapTiles from '../components/OneMapTiles.vue'
import TransitMobile from '../components/TransitMobile.vue'
import { useIsMobile } from '../../my-tasks/utils/useIsMobile.js'
import PersonAvatar from '../../my-tasks/components/PersonAvatar.vue'
import { getTask, getTransitSession, postMilestone, endTransit, resumeTransit, updateLocation } from '../services/transitApi.js'
import { useLiveLocation } from '../utils/useLiveLocation.js'
import { startTask, getErrorMessage } from '../../my-tasks/services/myTasksApi.js'
import { formatTime, recipientName } from '../../my-tasks/utils/formatters.js'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'

const props = defineProps({
    familyId: { type: String, required: true },
    taskId: { type: String, required: true }
})

const router = useRouter()
const isMobile = useIsMobile()
const { families } = useActiveFamily()
const POLL_MS = 10 * 1000

const task = ref(null)
const session = ref(null)
const isLoading = ref(true)
const loadError = ref('')
const actionError = ref('')
const notice = ref('')
const isPosting = ref(false)
const customText = ref('')
const lookedUpPlace = ref(null)

let me = {}
try { me = JSON.parse(sessionStorage.getItem('user') || '{}') } catch { me = {} }

const idOf = (value) => (value && typeof value === 'object' ? value._id : value)
const isActive = computed(() => session.value?.status === 'active')
const isEnded = computed(() => session.value?.status === 'ended')
const isCompanion = computed(() => Boolean(me.id) && idOf(session.value?.companion) === me.id)
const isClaimer = computed(() => Boolean(me.id) && idOf(task.value?.claimedBy) === me.id)
const canStart = computed(() => !session.value && isClaimer.value && task.value?.status === 'claimed')
const taskDone = computed(() => task.value?.status === 'completed')
// Undo an accidental "End transit" while the task is still in progress
const canResume = computed(() => isEnded.value && isCompanion.value && task.value?.status === 'in_progress')

const who = computed(() => recipientName(task.value))
const companionName = computed(() => session.value?.companion?.name || task.value?.claimedBy?.name || '')
const companionFirst = computed(() => companionName.value.split(' ')[0])
const familyName = computed(() => families.value.find((f) => f.id === props.familyId)?.name || 'family')
const destination = computed(() => task.value?.location || null)
const placeName = computed(() => destination.value?.name || destination.value?.address || '')

// Live location: the companion's own browser shares it; everyone else gets it from the server
const live = useLiveLocation({
    enabled: computed(() => isActive.value && isCompanion.value),
    send: (position) => updateLocation(props.familyId, props.taskId, position)
})
const liveSpot = computed(() => {
    if (!isActive.value) return null
    if (isCompanion.value && live.position.value) return live.position.value
    const last = session.value?.lastLocation
    return Number.isFinite(last?.lat) && Number.isFinite(last?.lng) ? last : null
})
// Browsers only share location while this page is open, so a position older than
// STALE_MS means it is paused (page closed, phone locked or no signal)
const STALE_MS = 2 * 60 * 1000
const now = ref(Date.now())
const isStale = computed(() => Boolean(liveSpot.value?.at) && now.value - new Date(liveSpot.value.at).getTime() > STALE_MS)

const locationNote = computed(() => ({
    waiting: 'Finding your location…',
    sharing: '📍 Sharing your location with the family. Keep this page open: sharing pauses if you leave it or lock your phone.',
    denied: 'Location is blocked. Allow it in your browser (the icon left of the address bar) so the family can see you on the map.',
    unsupported: 'This browser can’t share location here.'
}[live.status.value] || ''))

const milestones = computed(() => session.value?.milestones || [])
const latest = computed(() => milestones.value[milestones.value.length - 1] || null)
const postedLabels = computed(() => new Set(milestones.value.map((m) => m.label.toLowerCase())))
const postedTypes = computed(() => new Set(milestones.value.map((m) => m.type)))

// Preset chips. departed / arrived / heading_home / home are the server's step types;
// the rest are saved as custom updates with that text. Used chips disappear.
const chips = computed(() => {
    const all = [
        { type: 'departed', label: who.value ? `On the way to fetch ${who.value}` : 'On the way' },
        { type: 'custom', label: who.value ? `Fetched ${who.value}` : 'Picked up' },
        { type: 'arrived', label: 'Reached hospital' },
        { type: 'custom', label: 'Seeing the doctor' },
        { type: 'custom', label: 'Collecting medicine' },
        { type: 'custom', label: 'Going for lunch' },
        { type: 'heading_home', label: 'Heading home' },
        { type: 'home', label: 'Safely back home' }
    ]
    return all.filter((chip) =>
        chip.type === 'custom' ? !postedLabels.value.has(chip.label.toLowerCase()) : !postedTypes.value.has(chip.type)
    )
})

const subtitle = computed(() => {
    const parts = [task.value?.title]
    if (companionFirst.value) parts.push(who.value ? `${companionFirst.value} is with ${who.value}` : `with ${companionFirst.value}`)
    if (session.value?.startedAt) parts.push(`started ${formatTime(session.value.startedAt)}`)
    if (isActive.value) parts.push('family can follow live')
    if (isEnded.value) parts.push(taskDone.value ? 'safely back home' : 'transit ended')
    return parts.filter(Boolean).join(' · ')
})

const mapCaption = computed(() => {
    const at = placeName.value ? ` at ${placeName.value}` : ''
    if (liveSpot.value && isStale.value) return `Location paused · last seen ${formatTime(liveSpot.value.at)}`
    if (liveSpot.value) return `Live · ${companionFirst.value || 'Companion'} · updated ${formatTime(liveSpot.value.at)}`
    if (isEnded.value && session.value?.path?.length > 1) return `Route travelled${at}`
    if (!latest.value) return placeName.value ? `Live map · ${placeName.value}` : 'No location on this task'
    return `Live map · last ping ${formatTime(latest.value.at)}${at}`
})


// The message the family's Telegram group gets for the latest step (sent by F's notify())
const telegramPreview = computed(() => {
    if (!latest.value) return ''
    const step = latest.value
    const withWho = companionFirst.value ? `, with ${companionFirst.value}` : ''
    const subject = who.value || companionFirst.value || 'The trip'
    const lines = {
        departed: `${companionFirst.value || 'Someone'} is on the way${who.value ? ` to fetch ${who.value}` : ''}.`,
        arrived: `${subject} has arrived${placeName.value ? ` at ${placeName.value}` : ''}${withWho}.`,
        consultation_done: `${subject}'s consultation is done${withWho}.`,
        heading_home: `${subject} is heading home${withWho}.`,
        home: `${subject} is safely back home${withWho}.`
    }
    const text = lines[step.type] || `${step.label}${withWho}.`
    return `${text} ${formatTime(step.at)} · View in CareCircle`
})

function directionsUrl(place) {
    if (!place) return ''
    const target = Number.isFinite(place.lat) && Number.isFinite(place.lng)
        ? `${place.lat},${place.lng}`
        : [place.name, place.address].filter(Boolean).join(' ')
    return target ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}` : ''
}

// Friend-tracker bubble on the photo pin: when, and what they're doing
const liveBubbleTime = computed(() => {
    if (!liveSpot.value?.at) return ''
    const at = new Date(liveSpot.value.at)
    const day = at.toLocaleDateString('en-SG', { weekday: 'short', timeZone: 'Asia/Singapore' })
    return `${formatTime(at)} ${day}`
})
const liveBubbleNote = computed(() => {
    if (isStale.value) return 'Location paused'
    if (latest.value?.type === 'arrived') return `At ${placeName.value || 'the clinic'}`
    if (latest.value) return latest.value.label
    return placeName.value ? `On the way to ${placeName.value}` : 'On the way'
})

async function load({ quiet = false } = {}) {
    if (!quiet) isLoading.value = true
    try {
        // Reload the task each time too, so "completed" shows for people following along
        task.value = await getTask(props.familyId, props.taskId)
        session.value = await getTransitSession(props.familyId, props.taskId)
        loadError.value = ''
    } catch (error) {
        if (!quiet) loadError.value = getErrorMessage(error)
    } finally {
        isLoading.value = false
    }
}

async function run(action) {
    isPosting.value = true
    actionError.value = ''
    try {
        await action()
    } catch (error) {
        actionError.value = getErrorMessage(error)
        // 409: the trip ended or the task changed elsewhere. Show the latest state.
        if ([404, 409].includes(error.response?.status)) await load({ quiet: true })
    } finally {
        isPosting.value = false
    }
}

function post(milestone, { confirmed = false } = {}) {
    if (milestone.type === 'home' && !confirmed &&
        !window.confirm('Is everyone safely back home? This ends the trip and marks the task as done.')) return

    // Attach where the companion is, so the step is pinned on the map too
    const here = live.position.value
    if (here) milestone = { ...milestone, lat: here.lat, lng: here.lng }

    run(async () => {
        session.value = await postMilestone(props.familyId, props.taskId, milestone)
        if (milestone.type === 'custom') customText.value = ''
        if (milestone.type === 'home') task.value = await getTask(props.familyId, props.taskId)
    })
}

function postCustom() {
    const label = customText.value.trim()
    if (!label) {
        actionError.value = 'Type your update first.'
        return
    }
    post({ type: 'custom', label })
}

function endTrip() {
    if (!window.confirm('End transit without marking the task as done? Use "Safely back home" if everyone is home.')) return
    run(async () => {
        session.value = await endTransit(props.familyId, props.taskId)
    })
}

function resumeTrip() {
    run(async () => {
        session.value = await resumeTransit(props.familyId, props.taskId)
        notice.value = 'Transit resumed. The family can follow along again.'
    })
}

function startTrip() {
    run(async () => {
        const result = await startTask(props.familyId, props.taskId)
        task.value = { ...task.value, ...result.task }
        session.value = result.transitSession
        if (!result.transitSession) notice.value = 'This task has no transit, so it was just started.'
    })
}

function addNote() {
    // Care logs (F, SeungHak) will own this page: /recipients/:recipientId/log
    notice.value = 'Consultation notes are part of Care Logs, which is coming soon.'
}

// Poll while the trip is active so the family sees new steps without reloading
let timer = null
function stopPolling() {
    clearInterval(timer)
    timer = null
}
function startPolling() {
    stopPolling()
    timer = setInterval(() => {
        now.value = Date.now()
        if (document.visibilityState === 'visible' && !isPosting.value) load({ quiet: true })
    }, POLL_MS)
}
watch(isActive, (active) => (active ? startPolling() : stopPolling()))

// Opening a different trip while on this page
watch(() => [props.familyId, props.taskId], () => {
    task.value = null
    session.value = null
    load()
})

onMounted(load)
onUnmounted(stopPolling)
</script>

<template>
    <!-- Phones: Figma "Mobile prototype" → 16 · Transit mode -->
    <div v-if="isMobile">
        <p v-if="isLoading" class="status" role="status">Loading transit...</p>
        <p v-else-if="loadError" class="status is-error" role="alert">{{ loadError }}</p>
        <TransitMobile
            v-else-if="task"
            :task="task"
            :session="session"
            :who="who"
            :companion-first="companionFirst"
            :is-companion="isCompanion"
            :can-start="canStart"
            :is-posting="isPosting"
            :action-error="actionError"
            :notice="notice"
            :live-spot="liveSpot"
            :location-note="locationNote"
            :live-caption="mapCaption"
            :live-time="liveBubbleTime"
            :live-note="liveBubbleNote"
            :can-resume="canResume"
            @back="router.push({ name: 'task-detail', params: { familyId, taskId } })"
            @post="(m) => post(m, { confirmed: true })"
            @start="startTrip"
            @resume="resumeTrip"
            @dismiss="notice = ''"
        />
    </div>

    <!-- Laptops: Figma "Web wireframes" → 06 · Transit mode -->
    <div v-else class="transit-page">
        <div v-if="isLoading" class="status" role="status">
            <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
            Loading transit...
        </div>

        <div v-else-if="loadError" class="status is-error" role="alert">
            <span>{{ loadError }}</span>
            <button type="button" class="btn-secondary" @click="load()">Try again</button>
        </div>

        <template v-else-if="task">
            <!-- Header -->
            <header class="page-header">
                <div class="title">
                    <div class="title-row">
                        <h1>Transit mode</h1>
                        <span v-if="isActive" class="badge badge-live">● Live</span>
                        <span v-else-if="isEnded" class="badge badge-ended">Ended</span>
                    </div>
                    <p>{{ subtitle }}</p>
                </div>
                <button v-if="isActive && isCompanion" type="button" class="btn-secondary" :disabled="isPosting" @click="endTrip">
                    End transit
                </button>
                <button v-else type="button" class="btn-secondary" @click="router.push({ name: 'task-detail', params: { familyId, taskId } })">
                    Back to task
                </button>
            </header>

            <div v-if="notice" class="notice" role="status">
                {{ notice }}
                <button type="button" class="notice-close" aria-label="Dismiss" @click="notice = ''">×</button>
            </div>
            <div v-if="actionError" class="notice is-error" role="alert">{{ actionError }}</div>

            <div class="columns">
                <!-- Map column -->
                <div class="map-column">
                    <section class="map" aria-label="Map">
                        <OneMapTiles
                            :lat="destination?.lat ?? null"
                            :lng="destination?.lng ?? null"
                            :live-lat="liveSpot?.lat ?? null"
                            :live-lng="liveSpot?.lng ?? null"
                            :live-label="companionFirst"
                            :live-time="liveBubbleTime"
                            :live-note="liveBubbleNote"
                            :trail="session?.path || []"
                            :label="mapCaption"
                            :height="520"
                            :fit-width="560"
                            :bottom-space="liveSpot ? 100 : 0"
                        >
                            <!-- People on this trip (like a friend-tracker) -->
                            <div v-if="liveSpot" class="people-bar">
                                <span class="person">
                                    <PersonAvatar :name="companionFirst" :size="40" tone="peach" />
                                    <span>
                                        <strong>{{ companionFirst || 'Companion' }}</strong>
                                        <small :class="{ paused: isStale }">{{ isStale ? 'Location paused' : 'Sharing live' }}</small>
                                    </span>
                                </span>
                                <span v-if="who" class="person">
                                    <PersonAvatar :name="who" :size="40" tone="yellow" />
                                    <span>
                                        <strong>{{ who }}</strong>
                                        <small>With {{ companionFirst || 'companion' }}</small>
                                    </span>
                                </span>
                            </div>
                        </OneMapTiles>
                        <a v-if="directionsUrl(destination)" :href="directionsUrl(destination)" target="_blank" rel="noopener" class="directions">
                            Directions
                        </a>
                    </section>

                    <section v-if="telegramPreview" class="card telegram">
                        <span class="telegram-label">
                            <i class="bi bi-send" aria-hidden="true"></i>
                            What the {{ familyName }} Telegram group sees
                        </span>
                        <p>{{ telegramPreview }}</p>
                    </section>

                    <details class="card lookup">
                        <summary><i class="bi bi-search" aria-hidden="true"></i> Find a clinic with OneMap</summary>
                        <ClinicSearch @select="(place) => (lookedUpPlace = place)" />
                        <div v-if="lookedUpPlace" class="looked-up">
                            <span>
                                <strong>{{ lookedUpPlace.name }}</strong>
                                <small>{{ lookedUpPlace.address }}</small>
                            </span>
                            <a :href="directionsUrl(lookedUpPlace)" target="_blank" rel="noopener">Directions</a>
                        </div>
                    </details>
                </div>

                <!-- Journey updates -->
                <aside class="card journey">
                    <header class="people">
                        <span class="avatars">
                            <PersonAvatar :name="who" :size="44" />
                            <PersonAvatar v-if="companionName" :name="companionName" :size="44" tone="peach" class="second" />
                        </span>
                        <h2>Journey timeline</h2>
                    </header>

                    <div v-if="!session" class="not-started">
                        <p>Transit starts when {{ companionFirst || 'the person who claimed this task' }} taps "Start transit".</p>
                        <button v-if="canStart" type="button" class="btn-primary-cc wide" :disabled="isPosting" @click="startTrip">
                            Start transit mode
                        </button>
                    </div>

                    <p v-else-if="!milestones.length" class="empty">No updates yet.</p>

                    <ol v-else class="updates">
                        <li
                            v-for="(step, index) in milestones"
                            :key="`${step.type}-${step.at}`"
                            :class="{ current: index === milestones.length - 1 }"
                        >
                            <span class="rail" aria-hidden="true"><span class="rail-dot"></span><span class="rail-line"></span></span>
                            <span class="update-text">
                                <strong>{{ step.label }}</strong>
                                <small>
                                    <time :datetime="step.at">{{ formatTime(step.at) }}</time>
                                    <template v-if="companionFirst"> · {{ companionFirst }}</template>
                                    <template v-if="step.type === 'custom'"> · custom update</template>
                                </small>
                            </span>
                        </li>
                    </ol>

                    <p v-if="isEnded" class="ended-note">
                        <i class="bi" :class="taskDone ? 'bi-house-heart-fill' : 'bi-flag'" aria-hidden="true"></i>
                        {{ taskDone ? 'Safely back home. The task is marked as done.' : 'Transit ended. The task is still in progress.' }}
                    </p>
                    <button v-if="canResume" type="button" class="btn-secondary wide resume" :disabled="isPosting" @click="resumeTrip">
                        <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i> Resume transit
                    </button>

                    <section v-if="isActive && isCompanion" class="post-box" aria-labelledby="post-title">
                        <h3 id="post-title">Post the next update</h3>
                        <div class="chips">
                            <button
                                v-for="chip in chips"
                                :key="`${chip.type}-${chip.label}`"
                                type="button"
                                class="badge chip"
                                :class="{ 'chip-home': chip.type === 'home' }"
                                :disabled="isPosting"
                                @click="post({ type: chip.type, label: chip.label })"
                            >
                                <template v-if="chip.type === 'home'">✓ </template>{{ chip.label }}
                            </button>
                        </div>

                        <form class="custom-row" @submit.prevent="postCustom">
                            <input
                                v-model="customText"
                                type="text"
                                maxlength="80"
                                placeholder="Or type your own update…"
                                aria-label="Your own update"
                            />
                            <button type="submit" class="btn-primary-cc" :disabled="isPosting">Post</button>
                        </form>

                        <p class="post-note">
                            Each update is time-stamped and sent to the family. “Safely back home” marks the task completed.
                        </p>
                        <p v-if="locationNote" class="post-note location-note" :class="{ 'is-warning': ['denied', 'unsupported'].includes(live.status.value) }">
                            {{ locationNote }}
                        </p>
                    </section>

                    <p v-else-if="isActive" class="viewer-note">
                        <i class="bi bi-eye" aria-hidden="true"></i>
                        You're following live. Only {{ companionFirst || 'the companion' }} can post updates.
                        <template v-if="isStale"> Their location is paused, probably because their Transit page is closed.</template>
                    </p>

                    <span class="push-down"></span>
                    <button type="button" class="btn-secondary wide" @click="addNote">Add consultation note</button>
                </aside>
            </div>
        </template>
    </div>
</template>

<style scoped>
.people-bar {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 26px;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 10px 16px;
    border-radius: 14px;
    background: var(--theme-panel, white);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.people-bar .person {
    display: flex;
    align-items: center;
    gap: 10px;
}

.people-bar .person > span {
    display: flex;
    flex-direction: column;
}

.people-bar strong {
    font-size: 15px;
    color: var(--theme-text, #2e2e2e);
}

.people-bar small {
    font-size: 13px;
    color: var(--theme-green, #2f7a3f);
}

.people-bar small.paused {
    color: var(--theme-warning, #7a5a00);
}


.resume {
    margin: -4px 0 12px;
}

.post-note.location-note {
    margin-top: 6px;
    color: var(--theme-green, #2f7a3f);
}

.post-note.location-note.is-warning {
    color: var(--theme-warning, #7a5a00);
}

/* Values from Figma file "CareCircle Wireframe", frame 06 · Transit mode */
.transit-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    color: var(--theme-text, #2e2e2e);
}

.status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 18px 4px;
    font-size: 14px;
    color: var(--theme-muted, #6b7280);
}

.status .spinner-border {
    color: var(--theme-green, #2f7a3f);
}

.status.is-error {
    color: var(--theme-danger, #a33a26);
}

/* Header */
.page-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
}

.title {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 260px;
}

.title-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

h1 {
    margin: 0;
    font-size: 30px;
    letter-spacing: 0.15px;
    font-weight: 700;
    color: var(--theme-text, #2e2e2e);
}

.title p {
    margin: 0;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0.08px;
    color: var(--theme-muted, #6b7280);
}

/* Badge component: 6px 10px, pill, 12px medium */
.badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border: none;
    border-radius: 999px;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.06px;
    font-weight: 500;
    white-space: nowrap;
}

.badge-live {
    background: var(--theme-green, #2f7a3f);
    color: white;
}

.badge-ended {
    background: var(--theme-page, #f3f4f6);
    color: var(--theme-muted, #6b7280);
}

/* Buttons: 12px 16px, radius 8, 14px medium */
.btn-secondary,
.btn-primary-cc {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    white-space: nowrap;
}

.btn-secondary {
    border: 1px solid var(--theme-border, #e5e7eb);
    background: var(--theme-panel, white);
    color: var(--theme-blue, #1f2937);
}

.btn-secondary:hover {
    background: var(--theme-page, #f9fafb);
}

.btn-primary-cc {
    border: 1px solid var(--theme-accent-border, #2f7a3f);
    background: var(--theme-green, #2f7a3f);
    color: white;
}

.btn-primary-cc:hover {
    background: #286a36;
}

.wide {
    width: 100%;
}

button:disabled {
    opacity: 0.6;
}

/* Messages */
.notice {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid var(--theme-warning-border, #ffe6a3);
    border-radius: 12px;
    background: var(--theme-warning-soft, #fff8e1);
    font-size: 14px;
    color: var(--theme-warning, #7a5a00);
}

.notice.is-error {
    border-color: var(--theme-danger-border, #ffd2c8);
    background: var(--theme-danger-soft, #ffe9e4);
    color: var(--theme-danger, #a33a26);
}

.notice-close {
    border: none;
    background: none;
    color: inherit;
    font-size: 18px;
    line-height: 1;
}

/* Columns */
.columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    gap: 24px;
    align-items: stretch;
}

.map-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
}

.card {
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 16px;
    background: var(--theme-panel, white);
}

/* Map (OneMap) */
.map {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.directions {
    position: absolute;
    right: 12px;
    top: 12px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--theme-panel, white);
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-green, #2f7a3f);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.telegram {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
}

.telegram-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.06px;
    font-weight: 600;
    color: var(--theme-muted, #6b7280);
}

.telegram p {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    color: var(--theme-text, #2e2e2e);
}

.lookup {
    padding: 14px 16px;
}

.lookup summary {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-green, #2f7a3f);
    cursor: pointer;
}

.lookup[open] summary {
    margin-bottom: 10px;
}

.looked-up {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
}

.looked-up span {
    display: flex;
    flex-direction: column;
}

.looked-up strong {
    font-size: 14px;
    color: var(--theme-text, #2e2e2e);
}

.looked-up small {
    font-size: 12px;
    color: var(--theme-muted, #6b7280);
}

.looked-up a {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-green, #2f7a3f);
}

/* Journey updates panel */
.journey {
    display: flex;
    flex-direction: column;
    padding: 24px;
}

.people {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
}

.avatars {
    display: flex;
}

.avatars .second {
    margin-left: -12px;
}

h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.09px;
    font-weight: 600;
    color: var(--theme-text, #2e2e2e);
}

.updates {
    margin: 0;
    padding: 0;
    list-style: none;
}

.updates li {
    display: flex;
    gap: 12px;
}

.rail {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.rail-dot {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--theme-green, #2f7a3f);
}

.current .rail-dot {
    box-shadow: 0 0 0 5px var(--theme-soft, #e8f5e9);
}

.rail-line {
    flex: 1;
    width: 2px;
    background: #6dbf7c;
}

.current .rail-line {
    display: none;
}

.update-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: 16px;
}

.update-text strong {
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    color: var(--theme-text, #2e2e2e);
}

.current .update-text strong {
    font-weight: 700;
}

.update-text small {
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.06px;
    color: var(--theme-muted, #6b7280);
}

.empty,
.not-started p {
    margin: 0 0 14px;
    font-size: 14px;
    color: var(--theme-muted, #6b7280);
}

.ended-note,
.viewer-note {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 14px;
}

.ended-note {
    background: var(--theme-soft, #e8f5e9);
    color: var(--theme-green, #2f7a3f);
    font-weight: 600;
}

.viewer-note {
    border: 1px solid var(--theme-border, #e5e7eb);
    background: var(--theme-page, #fbfbf7);
    color: var(--theme-muted, #6b7280);
}

/* Post the next update */
.post-box {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 16px;
    background: var(--theme-page, #fbfbf7);
}

h3 {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 600;
    color: var(--theme-text, #2e2e2e);
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.chip {
    background: var(--theme-panel, white);
    color: var(--theme-text, #2e2e2e);
}

.chip:hover {
    box-shadow: inset 0 0 0 1px #6dbf7c;
}

.chip-home {
    background: var(--theme-soft, #e8f5e9);
    color: var(--theme-green, #2f7a3f);
}

.custom-row {
    display: flex;
    gap: 8px;
}

.custom-row input {
    flex: 1;
    min-width: 0;
    padding: 12px 16px;
    border: 1px solid var(--theme-border, #e5e7eb);
    border-radius: 8px;
    background: var(--theme-panel, white);
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    color: var(--theme-text, #2e2e2e);
}

.custom-row input::placeholder {
    color: var(--theme-muted, #6b7280);
}

.custom-row input:focus {
    outline: 2px solid var(--theme-accent-border, #6dbf7c);
    outline-offset: -1px;
}

.post-note {
    margin: 0;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.06px;
    color: var(--theme-muted, #6b7280);
}

.push-down {
    flex: 1;
    min-height: 16px;
}

@media (max-width: 991px) {
    .columns {
        grid-template-columns: 1fr;
    }

    .map :deep(.onemap) {
        height: 260px !important;
    }

    /* On phones the timeline comes first, map below */
    .journey {
        order: -1;
    }


    h1 {
        font-size: 24px;
    }
}
</style>
