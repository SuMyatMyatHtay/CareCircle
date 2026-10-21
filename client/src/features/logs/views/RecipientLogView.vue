<script setup>
// Owner: SeungHak (F)
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { useRecipient } from '../../../composables/useRecipients.js'
import { queryKeys } from '../../../services/queryClient.js'
import LogForm from '../components/LogForm.vue'
import LogList from '../components/LogList.vue'
import LogTypeFilter from '../components/LogTypeFilter.vue'
import { getLogs, createLog, updateLog, deleteLog, translateLog, getLogErrorMessage, TRANSLATION_NOT_CONNECTED } from '../services/logsApi.js'
import { displayName } from '../../recipients/recipientLabels.js'

const PAGE_SIZE = 20

const route = useRoute()
const { selectedFamilyId, selectedFamily } = useActiveFamily()

const recipientId = computed(() => route.params.recipientId)

// Other pages (e.g. the recipient Overview) cache this family's notes. Mark them
// out of date after any change here so they show it next time.
const queryClient = useQueryClient()
function invalidateCachedLogs() {
    queryClient.invalidateQueries({ queryKey: queryKeys.logs(selectedFamilyId.value) })
}

function readUser() {
    try {
        return JSON.parse(sessionStorage.getItem('user') || '{}')
    } catch {
        return {}
    }
}
const user = readUser()

const isAdmin = computed(() =>
    selectedFamily.value?.members?.some((m) => m.userId === user.id && m.role === 'admin') ?? false
)

function canChange(log) {
    return log.author?._id === user.id || isAdmin.value
}

async function translate(log, lang) {
    try {
        return await translateLog(selectedFamilyId.value, log._id, lang)
    } catch (error) {
        throw new Error(error.message === TRANSLATION_NOT_CONNECTED ? error.message : getLogErrorMessage(error))
    }
}

const { recipient } = useRecipient(recipientId)
const recipientName = computed(() => displayName(recipient.value))

const logs = ref([])
const isLoading = ref(false)
const loadError = ref('')
const hasMore = ref(false)
const isLoadingMore = ref(false)

function isCurrent(familyId, forRecipient) {
    return familyId === selectedFamilyId.value && forRecipient === recipientId.value
}

async function loadLogs() {
    const familyId = selectedFamilyId.value
    const forRecipient = recipientId.value
    loadError.value = ''
    editingId.value = ''

    if (!familyId) {
        logs.value = []
        return
    }

    isLoading.value = true
    try {
        const result = await getLogs(familyId, { recipient: forRecipient, limit: PAGE_SIZE })
        if (!isCurrent(familyId, forRecipient)) return
        logs.value = result
        hasMore.value = result.length === PAGE_SIZE
    } catch (error) {
        if (!isCurrent(familyId, forRecipient)) return
        logs.value = []
        loadError.value = getLogErrorMessage(error)
    } finally {
        if (isCurrent(familyId, forRecipient)) isLoading.value = false
    }
}

async function loadMore() {
    const familyId = selectedFamilyId.value
    const forRecipient = recipientId.value
    const oldest = logs.value[logs.value.length - 1]
    if (!oldest || isLoadingMore.value) return

    isLoadingMore.value = true
    actionError.value = ''
    try {
        const older = await getLogs(familyId, {
            recipient: forRecipient,
            before: oldest.createdAt,
            limit: PAGE_SIZE
        })
        if (!isCurrent(familyId, forRecipient)) return
        logs.value = [...logs.value, ...older]
        hasMore.value = older.length === PAGE_SIZE
    } catch (error) {
        actionError.value = getLogErrorMessage(error)
    } finally {
        isLoadingMore.value = false
    }
}

onMounted(loadLogs)
watch([selectedFamilyId, recipientId], loadLogs)

const selectedType = ref('')
const shownLogs = computed(() =>
    selectedType.value ? logs.value.filter((log) => log.type === selectedType.value) : logs.value
)
const emptyMessage = computed(() =>
    selectedType.value
        ? 'No notes of this type yet.'
        : `No notes yet. Add the first update${recipientName.value ? ` for ${recipientName.value}` : ''} above.`
)

const form = ref(null)
const isPosting = ref(false)
const postError = ref('')

async function postUpdate(payload) {
    isPosting.value = true
    postError.value = ''
    try {
        const log = await createLog(selectedFamilyId.value, { ...payload, recipient: recipientId.value })
        logs.value = [log, ...logs.value]
        invalidateCachedLogs()
        selectedType.value = ''
        form.value?.reset()
    } catch (error) {
        postError.value = getLogErrorMessage(error)
    } finally {
        isPosting.value = false
    }
}

const editingId = ref('')
const isSavingEdit = ref(false)
const editError = ref('')

function startEdit(log) {
    editingId.value = log._id
    editError.value = ''
}

async function saveEdit(log, changes) {
    isSavingEdit.value = true
    editError.value = ''
    try {
        const updated = await updateLog(selectedFamilyId.value, log._id, changes)
        logs.value = logs.value.map((item) => (item._id === updated._id ? updated : item))
        invalidateCachedLogs()
        editingId.value = ''
    } catch (error) {
        editError.value = getLogErrorMessage(error)
    } finally {
        isSavingEdit.value = false
    }
}

const actionError = ref('')

async function removeLog(log) {
    if (!window.confirm('Delete this note? This cannot be undone.')) return

    actionError.value = ''
    try {
        await deleteLog(selectedFamilyId.value, log._id)
        logs.value = logs.value.filter((item) => item._id !== log._id)
        invalidateCachedLogs()
    } catch (error) {
        if (error.response?.status === 404) {
            logs.value = logs.value.filter((item) => item._id !== log._id)
        }
        actionError.value = getLogErrorMessage(error)
    }
}
</script>

<template>
    <div class="log-page">
        <nav class="breadcrumb-row" aria-label="Breadcrumb">
            <RouterLink to="/home">Family home</RouterLink>
            <span aria-hidden="true">/</span>
            <span>{{ recipientName || 'Care recipient' }}</span>
            <span aria-hidden="true">/</span>
            <span class="current" aria-current="page">Log</span>
        </nav>

        <header class="log-header">
            <h1>{{ recipientName ? `${recipientName}'s care log` : 'Care log' }}</h1>
            <p>Notes after appointments, medication changes and daily updates, shared with the family.</p>
        </header>

        <section v-if="!selectedFamily" class="no-family">
            <p>Choose a family in the sidebar to see its care notes.</p>
        </section>

        <div v-else class="row g-3">
            <div class="col-lg-8 order-2 order-lg-1 d-flex flex-column gap-3">
                <LogForm
                    ref="form"
                    :recipient-name="recipientName"
                    :is-saving="isPosting"
                    :error-message="postError"
                    @submit="postUpdate"
                />

                <p v-if="actionError" class="action-error" role="alert">
                    <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
                    {{ actionError }}
                    <button type="button" aria-label="Dismiss" @click="actionError = ''">
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </p>

                <LogList
                    :logs="shownLogs"
                    :is-loading="isLoading"
                    :error-message="loadError"
                    :empty-message="emptyMessage"
                    :can-change="canChange"
                    :translate="translate"
                    :has-more="hasMore && !selectedType"
                    :is-loading-more="isLoadingMore"
                    :editing-id="editingId"
                    :is-saving-edit="isSavingEdit"
                    :edit-error="editError"
                    @retry="loadLogs"
                    @load-more="loadMore"
                    @edit="startEdit"
                    @delete="removeLog"
                    @save-edit="saveEdit"
                    @cancel-edit="editingId = ''"
                />
            </div>

            <aside class="col-lg-4 order-1 order-lg-2">
                <div class="filter-sticky">
                    <LogTypeFilter v-model="selectedType" :logs="logs" />
                </div>
            </aside>
        </div>
    </div>
</template>

<style scoped>
.log-page {
    max-width: 1100px;
}

.breadcrumb-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--theme-muted, #7B8391);
}

.breadcrumb-row a {
    color: var(--theme-muted, #7B8391);
    text-decoration: none;
}

.breadcrumb-row a:hover {
    color: var(--theme-green, #3B7A4F);
    text-decoration: underline;
}

.breadcrumb-row .current {
    color: var(--theme-text, #2F2F2F);
    font-weight: 700;
}

.log-header {
    margin-bottom: 20px;
}

.log-header h1 {
    margin-bottom: 3px;
    font-size: 28px;
    font-weight: 900;
}

.log-header p {
    margin: 0;
    color: var(--theme-muted, #7B8391);
    font-size: 15px;
}

.no-family {
    padding: 28px;
    background: var(--theme-panel, white);
    border: 1px dashed var(--theme-border, #D5E2D8);
    border-radius: 14px;
    color: var(--theme-muted, #7B8391);
}

.no-family p {
    margin: 0;
}

.action-error {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
    font-size: 14px;
}

.action-error button {
    margin-left: auto;
    border: none;
    background: transparent;
    color: inherit;
}

@media (min-width: 992px) {
    .filter-sticky {
        position: sticky;
        top: 16px;
    }
}

@media (max-width: 767px) {
    .log-header h1 {
        font-size: 23px;
    }
}
</style>
