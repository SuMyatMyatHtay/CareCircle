<script setup>
// Owner: Marcus (D)
// "Where? (optional)": OneMap search, with the recipient's preferred clinic suggested first.
// The chosen place shows as a green card with "Change".
//   <TaskPlacePicker v-model="form.location.value" :suggestion="recipient.preferredClinic" suggestion-label="Grandpa's preferred clinic" />
import { ref, computed, watch, nextTick, onBeforeUnmount, useId } from 'vue'
import { searchPlaces } from '../../services/oneMapApi.js'

const props = defineProps({
    // { name, address, postal, lat, lng }, e.g. the recipient's preferred clinic
    suggestion: { type: Object, default: null },
    suggestionLabel: { type: String, default: '' },
    error: { type: String, default: '' }
})

const model = defineModel({ type: Object, default: null })

const id = useId()
const searchInput = ref(null)
const query = ref('')
const results = ref([])
const isSearching = ref(false)
const searchError = ref('')
const isOpen = ref(false)

const hasSuggestion = computed(() => Boolean(props.suggestion?.name || props.suggestion?.address))

function placeLine(place) {
    return [place.address, place.postal ? `S${place.postal}` : ''].filter(Boolean).join(' · ')
}

// ---- Search, 300ms after typing stops; an older request is cancelled ----
let timer = null
let controller = null

watch(query, (value) => {
    clearTimeout(timer)
    controller?.abort()
    searchError.value = ''

    if (!value.trim()) {
        results.value = []
        isSearching.value = false
        return
    }

    isSearching.value = true
    timer = setTimeout(async () => {
        controller = new AbortController()
        try {
            results.value = await searchPlaces(value, { signal: controller.signal })
            isSearching.value = false
        } catch (error) {
            if (error.name === 'AbortError') return
            results.value = []
            searchError.value = 'Place search is unavailable. Try again in a moment.'
            isSearching.value = false
        }
    }, 300)
})

onBeforeUnmount(() => {
    clearTimeout(timer)
    controller?.abort()
})

function choose(place) {
    model.value = { name: place.name || '', address: place.address || '', postal: place.postal || '', lat: place.lat, lng: place.lng }
    query.value = ''
    isOpen.value = false
}

async function change() {
    model.value = null
    await nextTick()
    searchInput.value?.focus()
    isOpen.value = true
}

// Close the list when focus leaves the search box and its results
function onFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) isOpen.value = false
}
</script>

<template>
    <div class="task-field">
        <label class="task-label" :for="model ? null : `${id}-search`">
            Where? <span class="task-optional">(optional)</span>
        </label>

        <div v-if="model" class="place-card">
            <span class="place-icon" aria-hidden="true"><i class="bi bi-geo-alt"></i></span>
            <span class="place-text">
                <strong>{{ model.name || model.address }}</strong>
                <small v-if="placeLine(model)">{{ placeLine(model) }}</small>
            </span>
            <button type="button" class="place-change" @click="change">Change</button>
        </div>

        <div v-else class="place-search" @focusout="onFocusOut">
            <div class="search-box" :class="{ 'is-invalid': error }">
                <i class="bi bi-search" aria-hidden="true"></i>
                <input :id="`${id}-search`" ref="searchInput" v-model="query" type="search" autocomplete="off"
                    placeholder="Search OneMap, e.g. Tan Tock Seng" role="combobox"
                    :aria-expanded="isOpen" :aria-controls="`${id}-results`" @focus="isOpen = true"
                    @keydown.escape.stop="isOpen = false">
            </div>

            <ul v-if="isOpen && (hasSuggestion || query.trim())" :id="`${id}-results`" class="place-results" role="listbox">
                <li v-if="hasSuggestion" role="option" aria-selected="false">
                    <button type="button" class="place-result" @click="choose(suggestion)">
                        <i class="bi bi-star" aria-hidden="true"></i>
                        <span>
                            <strong>{{ suggestion.name || suggestion.address }}</strong>
                            <small>{{ suggestionLabel || placeLine(suggestion) }}</small>
                        </span>
                    </button>
                </li>
                <li v-if="isSearching" class="place-status" role="status">
                    <span class="spinner-border spinner-border-sm text-success" aria-hidden="true"></span>
                    Searching OneMap...
                </li>
                <li v-else-if="searchError" class="place-status is-error">{{ searchError }}</li>
                <li v-else-if="query.trim() && !results.length" class="place-status">No places found.</li>
                <li v-for="(place, index) in results" :key="`${place.postal}-${index}`" role="option" aria-selected="false">
                    <button type="button" class="place-result" @click="choose(place)">
                        <i class="bi bi-geo-alt" aria-hidden="true"></i>
                        <span>
                            <strong>{{ place.name }}</strong>
                            <small>{{ placeLine(place) }}</small>
                        </span>
                    </button>
                </li>
            </ul>
        </div>

        <p v-if="error" class="task-field-error" role="alert">{{ error }}</p>
        <p v-else-if="hasSuggestion && !model" class="task-hint">
            Suggested: {{ suggestionLabel || suggestion.name }} · or search OneMap
        </p>
    </div>
</template>

<style scoped>
.place-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--theme-accent-border, #C6E3CB);
    border-radius: 12px;
    background: var(--theme-soft, #F4FAF5);
}

.place-icon {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--theme-panel, white);
    color: var(--theme-green, #2F7A3F);
}

.place-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 14px;
}

.place-text small,
.place-result small {
    font-size: 12px;
    color: var(--theme-muted, #6B7280);
}

.place-change {
    min-height: 44px;
    padding: 0 4px;
    border: none;
    background: none;
    color: var(--theme-green, #2F7A3F);
    font-size: 13px;
    font-weight: 700;
}

.place-search {
    position: relative;
}

.search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border: 1px solid var(--theme-border, #D9DDD6);
    border-radius: 10px;
    background: var(--theme-panel, white);
    color: var(--theme-muted, #6B7280);
}

.search-box:focus-within {
    border-color: var(--theme-accent-border, #2F7A3F);
    box-shadow: 0 0 0 3px #E8F5E9;
}

.search-box.is-invalid {
    border-color: var(--theme-danger-border, #C0564B);
}

.search-box input {
    flex: 1;
    min-width: 0;
    height: 44px;
    border: none;
    outline: none;
    background: transparent;
    color: var(--theme-text, #2F2F2F);
    font-size: 14px;
}

.place-results {
    position: absolute;
    z-index: 5;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
    background: var(--theme-panel, white);
    border: 1px solid var(--theme-border, #E5E7EB);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(20, 31, 23, 0.08);
}

.place-results li + li {
    border-top: 1px solid var(--theme-border, #EEF0EC);
}

.place-result {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 10px 14px;
    border: none;
    background: var(--theme-panel, white);
    text-align: left;
    font-size: 14px;
    color: var(--theme-text, #2F2F2F);
}

.place-result span {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.place-result:hover,
.place-result:focus-visible {
    background: var(--theme-soft, #F4FAF5);
    outline: none;
}

.place-result .bi {
    color: var(--theme-muted, #6B7280);
}

.place-result .bi-star {
    color: var(--theme-green, #2F7A3F);
}

.place-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    font-size: 13px;
    color: var(--theme-muted, #6B7280);
}

.place-status.is-error {
    color: var(--theme-danger, #9A3A2A);
}
</style>
