<script setup>
// Owner: Marcus (D)
// All search results (Figma 18b on desktop, 21 on phones).
// The search word and every filter live in the URL, so results can be refreshed and shared:
//   /search?q=eye&type=tasks,logs&recipient=<id>&when=past30&status=open&sort=newest
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { useFamilySearch } from '../composables/useFamilySearch.js'
import { GROUPS, resultLink, resultKey, flattenResults } from '../searchFormat.js'
import SearchInput from '../components/SearchInput.vue'
import SearchResultRow from '../components/SearchResultRow.vue'
import '../search.css'

const PAGE_LIMIT = 50
// Phones show this many per group until "See all n results"
const CARD_PREVIEW = 3

const WHEN_OPTIONS = [
    { value: 'any', label: 'Any time' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past30', label: 'Past 30 days' },
    { value: 'past180', label: 'Past 6 months' }
]
const STATUS_OPTIONS = [
    { value: 'any', label: 'Any status' },
    { value: 'open', label: 'Needs someone' },
    { value: 'claimed', label: 'Claimed' },
    { value: 'completed', label: 'Completed' }
]
const SORT_OPTIONS = [
    { value: 'best', label: 'Best match' },
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' }
]
const GROUP_KEYS = GROUPS.map((group) => group.key)

const route = useRoute()
const router = useRouter()
const { recipients, selectedFamilyId } = useFamilyWorkspace()

// ---- URL -> state ----
const oneOf = (value, options, fallback) => (options.some((option) => option.value === value) ? value : fallback)

function showFromUrl(type) {
    const keys = String(type || '').split(',').filter((key) => GROUP_KEYS.includes(key))
    return keys.length ? keys : [...GROUP_KEYS]
}

function filtersFromUrl(query) {
    return {
        recipient: typeof query.recipient === 'string' ? query.recipient : '',
        when: oneOf(query.when, WHEN_OPTIONS, 'any'),
        status: oneOf(query.status, STATUS_OPTIONS, 'any'),
        sort: oneOf(query.sort, SORT_OPTIONS, 'best')
    }
}

const search = useFamilySearch({
    limit: PAGE_LIMIT,
    q: typeof route.query.q === 'string' ? route.query.q : '',
    filters: filtersFromUrl(route.query)
})
const { q, filters, state, counts, results, errorMessage, retry } = search
const shown = ref(showFromUrl(route.query.type))

// ---- State -> URL (replace, so typing doesn't fill the history) ----
function urlQuery() {
    const query = { q: q.value }
    if (shown.value.length < GROUP_KEYS.length) query.type = shown.value.join(',')
    if (filters.recipient) query.recipient = filters.recipient
    if (filters.when !== 'any') query.when = filters.when
    if (filters.status !== 'any') query.status = filters.status
    if (filters.sort !== 'best') query.sort = filters.sort
    return query
}

const sameQuery = (a, b) => JSON.stringify(a) === JSON.stringify(b)

watch([q, shown, () => ({ ...filters })], () => {
    const query = urlQuery()
    if (!sameQuery(query, route.query)) router.replace({ query })
}, { deep: true })

// Back/forward, or a place link opening this page again: follow the URL
watch(() => route.query, (query) => {
    if (route.name !== 'search' || sameQuery(query, urlQuery())) return
    q.value = typeof query.q === 'string' ? query.q : ''
    shown.value = showFromUrl(query.type)
    Object.assign(filters, filtersFromUrl(query))
})

// ---- Filters ----
const recipientPills = computed(() => [
    { id: '', name: 'Everyone' },
    ...recipients.value.map((recipient) => ({ id: recipient._id, name: recipient.nickname || recipient.name }))
])

function toggleShown(key) {
    const next = shown.value.includes(key) ? shown.value.filter((item) => item !== key) : [...shown.value, key]
    // Unticking the last one shows everything again rather than nothing
    shown.value = GROUP_KEYS.filter((item) => (next.length ? next : GROUP_KEYS).includes(item))
}

const hasFilters = computed(() =>
    shown.value.length < GROUP_KEYS.length || filters.recipient || filters.when !== 'any' || filters.status !== 'any'
)

function clearFilters() {
    shown.value = [...GROUP_KEYS]
    Object.assign(filters, { recipient: '', when: 'any', status: 'any' })
}

// ---- Results ----
const total = computed(() => shown.value.reduce((sum, key) => sum + counts.value[key], 0))
const rows = computed(() => flattenResults(results.value, shown.value, filters.sort))
const isCapped = computed(() => shown.value.some((key) => counts.value[key] > PAGE_LIMIT))
const linkFor = (row) => resultLink(row.kind, row.item, selectedFamilyId.value)
const trimmed = computed(() => q.value.trim())
const resultWord = (count) => `${count} ${count === 1 ? 'result' : 'results'}`

const announcement = computed(() => {
    if (state.value === 'loading') return 'Searching…'
    if (state.value === 'error') return errorMessage.value
    if (state.value === 'empty' || (state.value === 'results' && !total.value)) return `No matches for ${trimmed.value}`
    if (state.value === 'results') return `${resultWord(total.value)} for ${trimmed.value}`
    return ''
})

// ---- Phones ----
const isMobile = ref(window.innerWidth < 768)
const expanded = ref(false)
watch([trimmed, shown], () => { expanded.value = false })

// Frame 21 has no People pill; people still show under "All"
const mobilePills = computed(() => [
    { key: 'all', label: 'All', count: counts.value.all },
    ...GROUPS.filter((group) => group.key !== 'people').map((group) => ({ key: group.key, label: group.label, count: counts.value[group.key] }))
])
const mobilePill = computed(() => (shown.value.length === GROUP_KEYS.length ? 'all' : shown.value.length === 1 ? shown.value[0] : ''))

function pickMobilePill(key) {
    shown.value = key === 'all' ? [...GROUP_KEYS] : [key]
}

const mobileSections = computed(() =>
    GROUPS.filter((group) => shown.value.includes(group.key))
        .map((group) => {
            const list = results.value[group.key] || []
            return { ...group, items: expanded.value ? list : list.slice(0, CARD_PREVIEW) }
        })
        .filter((section) => section.items.length)
)
const hiddenOnMobile = computed(() =>
    !expanded.value && shown.value.some((key) => (results.value[key] || []).length > CARD_PREVIEW)
)

function cancel() {
    if (window.history.state?.back) router.back()
    else router.push('/home')
}

// ---- Focus the search box on arrival ----
const desktopInput = ref(null)
const mobileInput = ref(null)

async function focusInput() {
    await nextTick()
    const input = isMobile.value ? mobileInput.value : desktopInput.value
    input?.focus()
}

function onResize() {
    isMobile.value = window.innerWidth < 768
}

onMounted(() => {
    window.addEventListener('resize', onResize)
    focusInput()
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<template>
    <div class="search-page">
        <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>

        <!-- ================= Phones (frame 21) ================= -->
        <div v-if="isMobile" class="search-mobile">
            <header class="search-mobile-header">
                <div class="search-mobile-row">
                    <SearchInput ref="mobileInput" v-model="q" variant="mobile" />
                    <button type="button" class="search-cancel" @click="cancel">Cancel</button>
                </div>
                <div v-if="state === 'results'" class="search-pills search-pills--scroll" role="group" aria-label="Show results for">
                    <button
                        v-for="pill in mobilePills"
                        :key="pill.key"
                        type="button"
                        class="search-pill"
                        :class="{ 'is-selected': mobilePill === pill.key, 'is-zero': !pill.count }"
                        :aria-pressed="mobilePill === pill.key"
                        @click="pickMobilePill(pill.key)"
                    >
                        {{ pill.label }} · {{ pill.count }}
                    </button>
                </div>
            </header>

            <div class="search-mobile-body">
                <p v-if="state === 'idle'" class="search-card search-state">Type at least 2 letters.</p>
                <div v-else-if="state === 'loading'" class="search-card" aria-hidden="true">
                    <span v-for="n in 3" :key="n" class="search-skeleton"><span></span><span></span></span>
                </div>
                <div v-else-if="state === 'error'" class="search-card search-state" role="alert">
                    <span>{{ errorMessage }}</span>
                    <button type="button" class="search-text-button" @click="retry">Retry</button>
                </div>
                <div v-else-if="state === 'empty' || !mobileSections.length" class="search-card search-state">
                    <span>No matches for “{{ trimmed }}”.</span>
                    <span class="search-tip">Try the person's name with a word, like “Grandpa physio”.</span>
                </div>
                <template v-else>
                    <section v-for="section in mobileSections" :key="section.key" :aria-labelledby="`search-mobile-${section.key}`">
                        <h2 :id="`search-mobile-${section.key}`" class="search-group-heading">{{ section.heading }}</h2>
                        <ul class="search-mobile-list">
                            <li v-for="item in section.items" :key="resultKey(section.kind, item)">
                                <RouterLink :to="resultLink(section.kind, item, selectedFamilyId)" class="search-mobile-card">
                                    <SearchResultRow :kind="section.kind" :item="item" :query="trimmed" variant="card" />
                                </RouterLink>
                            </li>
                        </ul>
                    </section>
                    <button v-if="hiddenOnMobile" type="button" class="search-text-button search-mobile-all" @click="expanded = true">
                        See all {{ total }} results
                    </button>
                </template>
            </div>
        </div>

        <!-- ================= Desktop (frame 18b) ================= -->
        <template v-else>
            <div class="search-page-bar">
                <SearchInput ref="desktopInput" v-model="q" />
            </div>

            <div class="search-page-body">
                <aside class="search-filters" aria-label="Search filters">
                    <fieldset class="search-filter-group">
                        <legend class="search-filter-label">Show</legend>
                        <label v-for="group in GROUPS" :key="group.key" class="search-check">
                            <input
                                type="checkbox"
                                :checked="shown.includes(group.key)"
                                @change="toggleShown(group.key)"
                            >
                            <span class="search-check-name">{{ group.show }}</span>
                            <span class="search-check-count">{{ counts[group.key] }}</span>
                        </label>
                    </fieldset>

                    <fieldset v-if="recipients.length" class="search-filter-group">
                        <legend class="search-filter-label">For</legend>
                        <div class="search-for-pills">
                            <button
                                v-for="pill in recipientPills"
                                :key="pill.id"
                                type="button"
                                class="search-pill search-pill--for"
                                :class="{ 'is-selected': filters.recipient === pill.id }"
                                :aria-pressed="filters.recipient === pill.id"
                                @click="filters.recipient = pill.id"
                            >
                                {{ pill.name }}
                            </button>
                        </div>
                    </fieldset>

                    <label class="search-filter-group">
                        <span class="search-filter-label">When</span>
                        <select v-model="filters.when" class="form-select search-select">
                            <option v-for="option in WHEN_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                        </select>
                    </label>

                    <label class="search-filter-group">
                        <span class="search-filter-label">Task status</span>
                        <select v-model="filters.status" class="form-select search-select">
                            <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                        </select>
                    </label>

                    <button type="button" class="search-text-button search-clear-filters" :disabled="!hasFilters" @click="clearFilters">
                        Clear filters
                    </button>
                </aside>

                <section class="search-results" :aria-busy="state === 'loading'" aria-labelledby="search-results-title">
                    <div class="search-results-head">
                        <h1 id="search-results-title" class="search-results-title">
                            <template v-if="state === 'results'">{{ resultWord(total) }} for “{{ trimmed }}”</template>
                            <template v-else-if="state === 'idle'">Search the family</template>
                            <template v-else>Results for “{{ trimmed }}”</template>
                        </h1>
                        <label class="search-sort">
                            <span>Sort</span>
                            <select v-model="filters.sort" class="form-select search-select search-select--sort">
                                <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                        </label>
                    </div>

                    <p v-if="state === 'idle'" class="search-card search-state">Type at least 2 letters.</p>
                    <div v-else-if="state === 'loading'" class="search-card" aria-hidden="true">
                        <span v-for="n in 3" :key="n" class="search-skeleton"><span></span><span></span></span>
                    </div>
                    <div v-else-if="state === 'error'" class="search-card search-state" role="alert">
                        <span>{{ errorMessage }}</span>
                        <button type="button" class="search-text-button" @click="retry">Retry</button>
                    </div>
                    <p v-else-if="state === 'empty' || !rows.length" class="search-card search-state">
                        No matches for “{{ trimmed }}”.
                    </p>
                    <ul v-else class="search-card search-list">
                        <li v-for="row in rows" :key="row.key">
                            <RouterLink :to="linkFor(row)" class="search-list-link">
                                <SearchResultRow :kind="row.kind" :item="row.item" :query="trimmed" variant="page" />
                            </RouterLink>
                        </li>
                    </ul>

                    <p v-if="isCapped && state === 'results'" class="search-tip">
                        Showing the first {{ PAGE_LIMIT }} of each kind. Add a word to narrow it down.
                    </p>
                    <p class="search-tip">Can't find it? Try the person's name with a word, like “Grandpa physio”.</p>
                </section>
            </div>
        </template>
    </div>
</template>
