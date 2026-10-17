<script setup>
// Owner: Chaithra (E), CC-19
// Search clinics and places with OneMap. Emits "select" with a location in the
// same shape as task.location, so D's task form can use it too:
//   <ClinicSearch @select="(loc) => (form.location = loc)" />
import { ref } from 'vue'
import { searchClinics } from '../services/transitApi.js'
import { getErrorMessage } from '../../my-tasks/services/myTasksApi.js'

defineProps({
    placeholder: { type: String, default: 'Search a clinic or hospital, e.g. "TTSH"' }
})
const emit = defineEmits(['select'])

const query = ref('')
const results = ref([])
const showingOthers = ref(false) // true when no clinic matched and these are other places
const isSearching = ref(false)
const errorMessage = ref('')
const hasSearched = ref(false)

async function search() {
    const q = query.value.trim()
    if (q.length < 2) {
        errorMessage.value = 'Type at least 2 characters.'
        return
    }
    isSearching.value = true
    errorMessage.value = ''
    try {
        const found = await searchClinics(q)
        showingOthers.value = !found.clinics.length && found.otherPlaces.length > 0
        results.value = found.clinics.length ? found.clinics : found.otherPlaces
        hasSearched.value = true
    } catch (error) {
        errorMessage.value = getErrorMessage(error)
        results.value = []
    } finally {
        isSearching.value = false
    }
}

function choose(place) {
    emit('select', place)
    results.value = []
    hasSearched.value = false
    query.value = place.name
}
</script>

<template>
    <div class="clinic-search">
        <form class="search-row" role="search" @submit.prevent="search">
            <input
                v-model="query"
                type="search"
                class="form-control"
                :placeholder="placeholder"
                aria-label="Search clinics"
                maxlength="100"
            />
            <button type="submit" class="search-button" :disabled="isSearching">
                <span v-if="isSearching" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <i v-else class="bi bi-search" aria-hidden="true"></i>
                <span class="visually-hidden">Search</span>
            </button>
        </form>

        <p v-if="errorMessage" class="hint is-error" role="alert">{{ errorMessage }}</p>
        <p v-else-if="hasSearched && !results.length" class="hint">No clinics or places found. Try another name.</p>
        <p v-else-if="showingOthers" class="hint">No clinics matched, so these are other places with that name.</p>

        <ul v-if="results.length" class="results">
            <li v-for="place in results" :key="`${place.name}-${place.lat}-${place.lng}`">
                <button type="button" class="result" @click="choose(place)">
                    <i class="bi bi-geo-alt" aria-hidden="true"></i>
                    <span>
                        <strong>{{ place.name }}</strong>
                        <small>{{ place.address }}</small>
                    </span>
                </button>
            </li>
        </ul>
        <p class="credit">Search by OneMap, Singapore Land Authority</p>
    </div>
</template>

<style scoped>
.search-row {
    display: flex;
    gap: 8px;
}

.search-row .form-control {
    border-radius: 10px;
}

.search-button {
    flex: 0 0 auto;
    width: 44px;
    border: none;
    border-radius: 10px;
    background: #2f7a3f;
    color: white;
}

.hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: #6b7280;
}

.hint.is-error {
    color: #a33a26;
}

.results {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
}

.results li + li {
    border-top: 1px solid #e5e7eb;
}

.result {
    display: flex;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: white;
    text-align: left;
}

.result:hover {
    background: #e8f5e9;
}

.result .bi {
    color: #2f7a3f;
}

.result span {
    display: flex;
    flex-direction: column;
}

.result strong {
    font-size: 14px;
    color: #2e2e2e;
}

.result small {
    font-size: 12px;
    color: #6b7280;
}

.credit {
    margin: 6px 0 0;
    font-size: 11px;
    color: #6b7280;
}
</style>
