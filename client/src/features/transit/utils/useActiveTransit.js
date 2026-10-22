// Owner: Chaithra (E)
// The live trip in a family, shaped for the Family Home banners (B's TransitBanner and
// MobileTransitCard). Polls every 15 s, like the rest of Transit mode.
//   const { liveTransit, openLiveTransit } = useActiveTransit(selectedFamilyId)
//   liveTransit -> { recipient, companion, headline, mobileHeadline, detail, familyId, taskId } | null
import { ref, computed, watch, onMounted, onUnmounted, unref } from 'vue'
import { useRouter } from 'vue-router'
import { getActiveTransitSessions } from '../services/transitApi.js'
import { formatTime } from '../../my-tasks/utils/formatters.js'

const POLL_MS = 15 * 1000
const STEPS = ['departed', 'arrived', 'consultation_done', 'heading_home', 'home']
const NEXT_LABEL = {
    departed: 'arrived at clinic',
    arrived: 'consultation done',
    consultation_done: 'heading home',
    heading_home: 'safely home'
}

const idOf = (value) => (value && typeof value === 'object' ? value._id : value)

function toBanner(session, familyId) {
    if (!session) return null
    const task = session.task || {}
    const recipient = task.recipient && typeof task.recipient === 'object' ? task.recipient : null
    const who = recipient?.nickname || recipient?.name || task.title || 'Your family'
    const companion = session.companion || {}
    const companionFirst = (companion.name || 'someone').split(' ')[0]
    const place = task.location?.name || task.location?.address || 'the clinic'
    const steps = session.milestones || []
    const latest = steps[steps.length - 1]

    let mobileHeadline
    switch (latest?.type) {
        case 'departed': mobileHeadline = `${who} is on the way to ${place}`; break
        case 'arrived': mobileHeadline = `${who} arrived at ${place}`; break
        case 'consultation_done': mobileHeadline = `${who}'s consultation is done`; break
        case 'heading_home': mobileHeadline = `${who} is heading home`; break
        case 'custom': mobileHeadline = `${who}: ${latest.label}`; break
        default: mobileHeadline = `${who}'s trip has started`
    }

    const done = new Set(steps.map((s) => s.type))
    const doneCount = STEPS.filter((t) => done.has(t)).length
    const lastPreset = [...steps].reverse().find((s) => NEXT_LABEL[s.type])
    const next = lastPreset ? NEXT_LABEL[lastPreset.type] : 'arrived at clinic'
    const when = formatTime(latest?.at || session.startedAt)

    return {
        recipient: recipient || {},
        companion,
        mobileHeadline,
        // MobileTransitCard shows the part before " with " and the part before the first " · "
        headline: `${mobileHeadline} with ${companionFirst}`,
        detail: `${when} · ${doneCount} of ${STEPS.length} milestones · next: ${next}`,
        familyId,
        taskId: idOf(session.task)
    }
}

export function useActiveTransit(familyIdRef, { enabled = true } = {}) {
    const router = useRouter()
    const sessions = ref([])
    let timer = null
    let version = 0

    async function load() {
        const familyId = unref(familyIdRef)
        if (!enabled || !familyId) {
            sessions.value = []
            return
        }
        const current = ++version
        try {
            const list = await getActiveTransitSessions(familyId)
            if (current === version) sessions.value = list || []
        } catch {
            // Keep the last banner; the next poll tries again
        }
    }

    // Newest active trip first (the server sorts by startedAt)
    const liveTransit = computed(() => toBanner(sessions.value[0], unref(familyIdRef)))

    function openLiveTransit() {
        const banner = liveTransit.value
        if (banner?.taskId) {
            router.push({ name: 'transit', params: { familyId: banner.familyId, taskId: banner.taskId } })
        }
    }

    watch(() => unref(familyIdRef), () => {
        sessions.value = []
        load()
    })
    onMounted(() => {
        load()
        timer = setInterval(() => {
            if (document.visibilityState === 'visible') load()
        }, POLL_MS)
    })
    onUnmounted(() => clearInterval(timer))

    return { liveTransit, openLiveTransit, reload: load }
}
