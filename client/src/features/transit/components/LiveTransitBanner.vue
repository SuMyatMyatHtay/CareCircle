<script setup>
// Owner: Chaithra (E). Matches Figma "02 · Family home" → "Live transit banner".
// Shows on Family Home while someone in the selected family is in transit mode.
// Hidden when nobody is in transit. Refreshes every 15 seconds.
//   <LiveTransitBanner :family-id="selectedFamilyId" />
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PersonAvatar from '../../my-tasks/components/PersonAvatar.vue'
import { getActiveTransitSessions } from '../services/transitApi.js'
import { formatTime } from '../../my-tasks/utils/formatters.js'

const props = defineProps({
    familyId: { type: String, default: '' }
})

const router = useRouter()
const POLL_MS = 15 * 1000
const STEPS = [
    { type: 'departed', label: 'on the way' },
    { type: 'arrived', label: 'arrived' },
    { type: 'consultation_done', label: 'consultation done' },
    { type: 'heading_home', label: 'heading home' },
    { type: 'home', label: 'safely back home' }
]

const sessions = ref([])

const banners = computed(() => sessions.value
    .filter((s) => s.task) // skip sessions whose task was deleted
    .map((session) => {
        const task = session.task
        const recipient = task.recipient && typeof task.recipient === 'object'
            ? task.recipient.nickname || task.recipient.name
            : ''
        const companion = (session.companion?.name || '').split(' ')[0]
        const place = task.location?.name || task.location?.address || ''
        const milestones = session.milestones || []
        const latest = milestones[milestones.length - 1]
        const subject = recipient || task.title

        let headline = `${companion || 'Someone'} started transit for ${task.title}`
        if (latest) {
            const withWho = companion ? ` with ${companion}` : ''
            headline = {
                departed: `${companion || 'Someone'} is on the way${recipient ? ` to fetch ${recipient}` : ''}`,
                arrived: `${subject} arrived${place ? ` at ${place}` : ''}${withWho}`,
                consultation_done: `${subject}'s consultation is done${withWho}`,
                heading_home: `${subject} is heading home${withWho}`
            }[latest.type] || `${latest.label}${companion ? ` · ${companion}` : ''}`
        }

        const posted = new Set(milestones.map((m) => m.type))
        const done = STEPS.filter((s) => posted.has(s.type)).length
        const next = STEPS.find((s) => !posted.has(s.type))
        const detail = [
            latest ? formatTime(latest.at) : `started ${formatTime(session.startedAt)}`,
            `${done} of ${STEPS.length} milestones`,
            next ? `next: ${next.label}` : ''
        ].filter(Boolean).join(' · ')

        return { id: session._id, taskId: task._id, recipient, companion: session.companion?.name || '', headline, detail }
    }))

async function load() {
    if (!props.familyId) {
        sessions.value = []
        return
    }
    const familyId = props.familyId
    try {
        const result = await getActiveTransitSessions(familyId)
        // Ignore the reply if the family was switched while loading
        if (familyId === props.familyId) sessions.value = result
    } catch {
        // The banner is optional: on errors just don't show it
        sessions.value = []
    }
}

function viewLive(banner) {
    router.push({ name: 'transit', params: { familyId: props.familyId, taskId: banner.taskId } })
}

let timer = null
onMounted(() => {
    load()
    timer = setInterval(() => {
        if (document.visibilityState === 'visible') load()
    }, POLL_MS)
})
onUnmounted(() => clearInterval(timer))
watch(() => props.familyId, load)
</script>

<template>
    <div v-if="banners.length" class="live-banners">
        <button
            v-for="banner in banners"
            :key="banner.id"
            type="button"
            class="live-banner"
            :aria-label="`${banner.headline}. View live`"
            @click="viewLive(banner)"
        >
            <span class="people">
                <PersonAvatar :name="banner.recipient" :size="48" />
                <PersonAvatar v-if="banner.companion" :name="banner.companion" :size="48" tone="peach" class="second" />
            </span>

            <span class="text">
                <span class="eyebrow">LIVE · TRANSIT MODE</span>
                <strong>{{ banner.headline }}</strong>
                <span class="detail">{{ banner.detail }}</span>
            </span>

            <span class="view-live">View live</span>
        </button>
    </div>
</template>

<style scoped>
/* Values from Figma "02 · Family home" → Live transit banner */
.live-banners {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 28px;
}

.live-banner {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 16px 20px;
    border: none;
    border-radius: 16px;
    background: #e8f5e9;
    text-align: left;
}

.people {
    display: flex;
    flex: 0 0 auto;
}

.people .second {
    margin-left: -12px;
}

.text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.eyebrow {
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.06px;
    font-weight: 700;
    color: #2f7a3f;
}

strong {
    font-size: 18px;
    letter-spacing: 0.09px;
    font-weight: 600;
    color: #2e2e2e;
}

.detail {
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    color: #6b7280;
}

.view-live {
    flex: 0 0 auto;
    padding: 12px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.07px;
    font-weight: 500;
    color: #1f2937;
}

.live-banner:hover .view-live {
    background: #f9fafb;
}

@media (max-width: 575px) {
    .live-banner {
        flex-wrap: wrap;
    }

    .view-live {
        width: 100%;
        text-align: center;
    }
}
</style>
