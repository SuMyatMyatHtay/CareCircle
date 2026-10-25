// Owner: Chaithra (E)
// The family's live trips, shaped for the Family Home banners (B's TransitBanner and
// MobileTransitCard). Several people can be on a trip at once, so there's one banner each.
// Polls every 15 s, like the rest of Transit mode.
//   const { liveTransits, openLiveTransit } = useActiveTransit(selectedFamilyId)
//   liveTransits -> [{ recipient, companion, headline, mobileHeadline, detail, familyId, taskId }]
//   openLiveTransit(banner) opens that trip's Transit page
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
    heading_home: 'safely back home'
}

// Without a chosen profile picture, the shared avatar falls back by care type (every elderly
// person becomes Grandpa, every user becomes Alex). Pick the sample picture by name first.
const PICTURES = { grandpa: 'grandpa', grandma: 'grandma', emma: 'baby-emma', jasmine: 'jasmine', alex: 'alex', may: 'aunt-may', mia: 'mia' }
function withPicture(person) {
    if (!person || person.profilePicture) return person || {}
    const words = String(person.nickname || person.name || '').toLowerCase().split(/\s+/)
    const key = Object.keys(PICTURES).find((k) => words.includes(k))
    return key ? { ...person, profilePicture: `/avatars/people/${PICTURES[key]}.png` } : person
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
        recipient: withPicture(recipient),
        companion: withPicture(companion),
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
        // Clearing the selected family also invalidates a request already in flight.
        const current = ++version
        const familyId = unref(familyIdRef)
        if (!enabled || !familyId) {
            sessions.value = []
            return
        }
        try {
            const list = await getActiveTransitSessions(familyId)
            if (current === version) sessions.value = list || []
        } catch {
            // Keep the last banner; the next poll tries again
        }
    }

    // Newest trip first (the server sorts by startedAt)
    const liveTransits = computed(() => sessions.value.map((s) => toBanner(s, unref(familyIdRef))).filter(Boolean))
    const liveTransit = computed(() => liveTransits.value[0] || null)

    function openLiveTransit(banner = liveTransit.value) {
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
    onUnmounted(() => { version++; clearInterval(timer) })

    return { liveTransits, liveTransit, openLiveTransit, reload: load }
}
