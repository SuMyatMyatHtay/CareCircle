// Owner: Marcus (D)
// Search state shared by the search bar dropdown and the search page.
//
//   const search = useFamilySearch({ limit: 5 })
//   search.q.value = 'eye'            // searches 250ms after typing stops
//   search.filters.when = 'upcoming'  // filters search straight away
//   search.state.value                // 'idle' | 'loading' | 'results' | 'empty' | 'error'
//
// The family is the one selected in the sidebar (useFamilyWorkspace). An older request
// is cancelled when a newer one starts, so results never arrive out of order.
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { searchFamily, getSearchErrorMessage } from '../services/searchApi.js'

export const MIN_QUERY = 2
const DEBOUNCE_MS = 250

export function useFamilySearch({ limit = 5, q: initialQuery = '', filters: initialFilters = {} } = {}) {
    const { selectedFamilyId } = useFamilyWorkspace()

    const q = ref(initialQuery)
    const filters = reactive({ recipient: '', when: 'any', status: 'any', sort: 'best', ...initialFilters })
    const data = ref(null)
    const errorMessage = ref('')
    const isLoading = ref(false)

    const trimmed = computed(() => q.value.trim())
    const isIdle = computed(() => trimmed.value.length < MIN_QUERY)

    const state = computed(() => {
        if (isIdle.value) return 'idle'
        if (errorMessage.value) return 'error'
        // While typing, the previous results stay up until the new ones arrive
        if (!data.value) return 'loading'
        return data.value.counts.all ? 'results' : 'empty'
    })

    let timer = null
    let controller = null

    function cancel() {
        clearTimeout(timer)
        controller?.abort()
        controller = null
    }

    async function run() {
        cancel()
        const familyId = selectedFamilyId.value
        if (isIdle.value || !familyId) return

        controller = new AbortController()
        const { signal } = controller
        isLoading.value = true
        errorMessage.value = ''
        try {
            const result = await searchFamily(familyId, {
                q: trimmed.value,
                limit,
                recipient: filters.recipient,
                when: filters.when === 'any' ? '' : filters.when,
                status: filters.status === 'any' ? '' : filters.status,
                sort: filters.sort === 'best' ? '' : filters.sort
            }, { signal })
            if (signal.aborted) return
            data.value = result
            isLoading.value = false
        } catch (error) {
            if (axios.isCancel(error) || signal.aborted) return
            errorMessage.value = getSearchErrorMessage(error)
            isLoading.value = false
        }
    }

    // Typing: wait until it stops. Keep showing the last results meanwhile, so they don't flash.
    watch(trimmed, () => {
        cancel()
        errorMessage.value = ''
        if (isIdle.value) {
            data.value = null
            isLoading.value = false
            return
        }
        isLoading.value = true
        timer = setTimeout(run, DEBOUNCE_MS)
    })

    // Filters and switching family: search again straight away
    watch([() => ({ ...filters }), selectedFamilyId], () => {
        data.value = null
        run()
    }, { deep: true })

    onBeforeUnmount(cancel)

    function clear() {
        cancel()
        q.value = ''
    }

    if (!isIdle.value) run()

    return {
        q,
        filters,
        data,
        state,
        isLoading,
        errorMessage,
        counts: computed(() => data.value?.counts ?? { all: 0, tasks: 0, logs: 0, people: 0, places: 0 }),
        results: computed(() => data.value?.results ?? { tasks: [], logs: [], people: [], places: [] }),
        retry: run,
        clear
    }
}
