<script setup>
// Owner: Marcus (D)
// Search bar at the top of every desktop page (Figma 18). Results drop down under it,
// grouped as tasks, care log, people and places; "See all" opens the search page.
// Rendered once by AppLayout, above the page transition, so it doesn't animate with pages.
//
// Keyboard: Ctrl/Cmd+K focuses it from anywhere, ↑ ↓ move, Enter opens, Escape clears,
// Tab leaves. It's an ARIA combobox: the input owns a listbox of options.
import { ref, computed, watch, onMounted, onBeforeUnmount, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { useFamilySearch } from '../composables/useFamilySearch.js'
import { GROUPS, resultLink, resultKey } from '../searchFormat.js'
import SearchInput from './SearchInput.vue'
import SearchResultRow from './SearchResultRow.vue'
import '../search.css'

// The dropdown shows up to 3 results per group when "All" is picked
const PER_GROUP = 3

const id = useId()
const route = useRoute()
const router = useRouter()
const { selectedFamilyId } = useFamilyWorkspace()
const { q, state, counts, results, errorMessage, retry, clear } = useFamilySearch({ limit: 5 })

const root = ref(null)
const searchInput = ref(null)
const isOpen = ref(false)
const type = ref('all')
const activeIndex = ref(-1)

const isExpanded = computed(() => isOpen.value && state.value !== 'idle')

const pills = computed(() => [
    { key: 'all', label: 'All', count: counts.value.all },
    ...GROUPS.map((group) => ({ key: group.key, label: group.label, count: counts.value[group.key] }))
])

function searchPage(extra = {}) {
    return { name: 'search', query: { q: q.value.trim(), ...extra } }
}

// Every option in the order it appears: results, "n more" links, then "See all"
const sections = computed(() =>
    GROUPS.filter((group) => type.value === 'all' || type.value === group.key)
        .map((group) => {
            const list = results.value[group.key] || []
            const items = (type.value === 'all' ? list.slice(0, PER_GROUP) : list).map((item) => ({
                id: `${id}-${resultKey(group.kind, item)}`,
                kind: group.kind,
                item,
                to: resultLink(group.kind, item, selectedFamilyId.value)
            }))
            const hidden = counts.value[group.key] - items.length
            const more = hidden > 0
                ? { id: `${id}-more-${group.key}`, label: group.more(hidden), to: searchPage({ type: group.key }) }
                : null
            return { ...group, items, more }
        })
        .filter((section) => section.items.length)
)

const seeAll = computed(() => ({ id: `${id}-all`, to: searchPage() }))

const options = computed(() => [
    ...sections.value.flatMap((section) => (section.more ? [...section.items, section.more] : section.items)),
    seeAll.value
])

const activeId = computed(() => options.value[activeIndex.value]?.id)

const announcement = computed(() => {
    if (!isExpanded.value) return ''
    if (state.value === 'loading') return 'Searching…'
    if (state.value === 'error') return errorMessage.value
    if (state.value === 'empty') return `No matches for ${q.value.trim()}`
    const total = counts.value.all
    return `${total} ${total === 1 ? 'result' : 'results'}`
})

// A new search or filter starts with nothing picked: Enter then opens "See all"
watch([results, type], () => { activeIndex.value = -1 })
watch(() => route.fullPath, close)

function close() {
    isOpen.value = false
    activeIndex.value = -1
}

function go(option) {
    if (!option) return
    router.push(option.to)
    clear()
    type.value = 'all'
    close()
    searchInput.value?.input?.blur()
}

function move(step) {
    isOpen.value = true
    const count = options.value.length
    if (!count) return
    activeIndex.value = activeIndex.value < 0
        ? (step > 0 ? 0 : count - 1)
        : (activeIndex.value + step + count) % count
    document.getElementById(activeId.value)?.scrollIntoView({ block: 'nearest' })
}

function onKeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!isExpanded.value && state.value === 'idle') return
        event.preventDefault()
        move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter') {
        if (state.value === 'idle') return
        event.preventDefault()
        go(options.value[activeIndex.value] ?? seeAll.value)
    } else if (event.key === 'Escape') {
        event.preventDefault()
        clear()
        type.value = 'all'
        close()
    } else if (event.key === 'Tab') {
        close()
    } else {
        isOpen.value = true
    }
}

// Close when focus moves somewhere outside the bar and its dropdown
function onFocusOut(event) {
    if (!root.value?.contains(event.relatedTarget)) close()
}

function onScrimClick() {
    close()
    searchInput.value?.input?.blur()
}

// Ctrl+K (Cmd+K on a Mac) from anywhere in the app
function onShortcut(event) {
    if (event.key?.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
    const input = searchInput.value?.input
    if (!input || !input.offsetParent) return // hidden on phones
    event.preventDefault()
    input.focus()
    input.select()
    isOpen.value = true
}

onMounted(() => window.addEventListener('keydown', onShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', onShortcut))
</script>

<template>
    <div ref="root" class="family-search" :class="{ 'is-expanded': isExpanded }" @focusout="onFocusOut">
        <SearchInput
            ref="searchInput"
            v-model="q"
            shortcut
            role="combobox"
            aria-autocomplete="list"
            :aria-expanded="isExpanded"
            :aria-controls="`${id}-list`"
            :aria-activedescendant="isExpanded ? activeId : undefined"
            @focus="isOpen = true"
            @click="isOpen = true"
            @input="isOpen = true"
            @keydown="onKeydown"
        />

        <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>

        <!-- On body so it also dims the sidebar -->
        <Teleport to="body">
            <Transition name="care-fade">
                <div v-if="isExpanded" class="family-search-scrim" aria-hidden="true" @click="onScrimClick"></div>
            </Transition>
        </Teleport>

        <Transition name="care-drop">
            <div v-if="isExpanded" class="family-search-panel" :aria-busy="state === 'loading'">
                <!-- mousedown.prevent keeps focus in the input, so the dropdown stays open -->
                <div class="search-pills" role="group" aria-label="Show results for" @mousedown.prevent>
                    <button
                        v-for="pill in pills"
                        :key="pill.key"
                        type="button"
                        tabindex="-1"
                        class="search-pill"
                        :class="{ 'is-selected': type === pill.key, 'is-zero': !pill.count }"
                        :aria-pressed="type === pill.key"
                        @click="type = pill.key"
                    >
                        {{ pill.label }} · {{ pill.count }}
                    </button>
                </div>

                <div v-if="state === 'loading'" class="search-panel-body" aria-hidden="true">
                    <span v-for="n in 3" :key="n" class="search-skeleton"><span></span><span></span></span>
                </div>
                <div v-else-if="state === 'error'" class="search-panel-body search-state" role="alert">
                    <span>{{ errorMessage }}</span>
                    <button type="button" class="search-text-button" @mousedown.prevent @click="retry">Retry</button>
                </div>
                <div v-else-if="state === 'empty'" class="search-panel-body search-state">
                    <span>No matches for “{{ q.trim() }}”.</span>
                    <span class="search-tip">Try the person's name with a word, like “Grandpa physio”.</span>
                </div>

                <div :id="`${id}-list`" role="listbox" aria-label="Search results" class="search-listbox" @mousedown.prevent>
                    <template v-if="state === 'results'">
                        <div v-for="section in sections" :key="section.key" role="group" :aria-labelledby="`${id}-group-${section.key}`">
                            <div :id="`${id}-group-${section.key}`" class="search-group-heading">{{ section.heading }}</div>
                            <div
                                v-for="option in section.items"
                                :id="option.id"
                                :key="option.id"
                                role="option"
                                class="search-option"
                                :class="{ 'is-active': activeId === option.id }"
                                :aria-selected="activeId === option.id"
                                @mousemove="activeIndex = options.indexOf(option)"
                                @click="go(option)"
                            >
                                <SearchResultRow :kind="option.kind" :item="option.item" :query="q.trim()" />
                            </div>
                            <div
                                v-if="section.more"
                                :id="section.more.id"
                                role="option"
                                class="search-option search-more"
                                :class="{ 'is-active': activeId === section.more.id }"
                                :aria-selected="activeId === section.more.id"
                                @mousemove="activeIndex = options.indexOf(section.more)"
                                @click="go(section.more)"
                            >
                                {{ section.more.label }}
                            </div>
                        </div>
                    </template>
                    <div
                        :id="seeAll.id"
                        role="option"
                        class="search-see-all"
                        :class="{ 'is-active': activeId === seeAll.id }"
                        :aria-selected="activeId === seeAll.id"
                        @mousemove="activeIndex = options.length - 1"
                        @click="go(seeAll)"
                    >
                        <span class="search-see-all-label">
                            See all {{ state === 'results' ? `${counts.all} ` : '' }}results for “{{ q.trim() }}”
                        </span>
                        <span class="search-see-all-hint" aria-hidden="true">↑ ↓ move · Enter open</span>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>
