// Owner: SeungHak (F)
// Edit, delete and translate for a list of care log notes.
// Shared by the recipient's Log page and "Notes from this visit" on the task pages.
//
//   const actions = useLogActions(familyId, logs)
//   <LogList :logs="logs" :can-change="actions.canChange" :translate="actions.translate" ... />
import { computed, ref, unref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useActiveFamily } from '../../composables/useActiveFamily.js'
import { queryKeys } from '../../services/queryClient.js'
import { updateLog, deleteLog, translateLog, getLogErrorMessage, TRANSLATION_NOT_CONNECTED } from './services/logsApi.js'

function readUser() {
    try {
        return JSON.parse(sessionStorage.getItem('user') || '{}')
    } catch {
        return {}
    }
}

// familyId: a ref or getter; logs: the ref holding the notes on screen
export function useLogActions(familyId, logs) {
    const currentFamilyId = () => (typeof familyId === 'function' ? familyId() : unref(familyId))
    const user = readUser()
    const { families } = useActiveFamily()

    const isAdmin = computed(() => {
        const family = families.value.find((f) => f.id === currentFamilyId())
        return family?.members?.some((m) => m.userId === user.id && m.role === 'admin') ?? false
    })

    function canChange(log) {
        return log.author?._id === user.id || isAdmin.value
    }

    // Other pages (e.g. the recipient Overview) cache this family's notes. Mark them
    // out of date after any change so they show it next time.
    const queryClient = useQueryClient()
    function invalidateCachedLogs() {
        queryClient.invalidateQueries({ queryKey: queryKeys.logs(currentFamilyId()) })
    }

    async function translate(log, lang) {
        try {
            return await translateLog(currentFamilyId(), log._id, lang)
        } catch (error) {
            throw new Error(error.message === TRANSLATION_NOT_CONNECTED ? error.message : getLogErrorMessage(error))
        }
    }

    const editingId = ref('')
    const isSavingEdit = ref(false)
    const editError = ref('')
    const actionError = ref('')

    function startEdit(log) {
        editingId.value = log._id
        editError.value = ''
    }

    function cancelEdit() {
        editingId.value = ''
    }

    async function saveEdit(log, changes) {
        isSavingEdit.value = true
        editError.value = ''
        try {
            const updated = await updateLog(currentFamilyId(), log._id, changes)
            logs.value = logs.value.map((item) => (item._id === updated._id ? updated : item))
            invalidateCachedLogs()
            editingId.value = ''
        } catch (error) {
            editError.value = getLogErrorMessage(error)
        } finally {
            isSavingEdit.value = false
        }
    }

    async function removeLog(log) {
        if (!window.confirm('Delete this note? This cannot be undone.')) return

        actionError.value = ''
        try {
            await deleteLog(currentFamilyId(), log._id)
            logs.value = logs.value.filter((item) => item._id !== log._id)
            invalidateCachedLogs()
        } catch (error) {
            if (error.response?.status === 404) {
                logs.value = logs.value.filter((item) => item._id !== log._id)
            }
            actionError.value = getLogErrorMessage(error)
        }
    }

    return {
        canChange,
        translate,
        invalidateCachedLogs,
        editingId,
        isSavingEdit,
        editError,
        actionError,
        startEdit,
        cancelEdit,
        saveEdit,
        removeLog
    }
}
