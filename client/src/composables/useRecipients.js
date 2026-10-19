// The selected family's care recipients (package C), cached with TanStack Query.
// The sidebar, Family home and the recipient pages all read the same cached list,
// and it follows the family picked in the sidebar on its own.
// Call refresh() after a create, edit or archive so every place updates.
//
//   const { recipients, isLoading, errorMessage, refresh } = useRecipients()
//   const { recipient, notFound, setRecipient } = useRecipient(recipientIdRef)

import { computed } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useActiveFamily } from './useActiveFamily.js'
import { queryKeys } from '../services/queryClient.js'
import { getRecipients, getRecipient, getRecipientErrorMessage } from '../features/recipients/services/recipientsApi.js'

export function useRecipients() {
    const { selectedFamilyId } = useActiveFamily()
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: computed(() => queryKeys.recipientList(selectedFamilyId.value)),
        queryFn: ({ queryKey }) => getRecipients(queryKey[1]),
        enabled: computed(() => Boolean(selectedFamilyId.value))
    })

    const recipients = computed(() => query.data.value ?? [])
    const errorMessage = computed(() =>
        query.error.value && !query.data.value ? getRecipientErrorMessage(query.error.value) : ''
    )

    // Refetch the list and every cached recipient of this family
    function refresh() {
        return queryClient.invalidateQueries({ queryKey: queryKeys.recipients(selectedFamilyId.value) })
    }

    return {
        recipients,
        isLoading: query.isLoading,
        errorMessage,
        refresh
    }
}

// One recipient, for the recipient hub. Shows the copy from the cached list straight
// away (if there is one) while the full record loads.
export function useRecipient(recipientId) {
    const { selectedFamilyId } = useActiveFamily()
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: computed(() => queryKeys.recipient(selectedFamilyId.value, recipientId.value)),
        queryFn: ({ queryKey }) => getRecipient(queryKey[1], queryKey[4]),
        enabled: computed(() => Boolean(selectedFamilyId.value && recipientId.value)),
        placeholderData: () =>
            queryClient
                .getQueryData(queryKeys.recipientList(selectedFamilyId.value))
                ?.find((r) => r._id === recipientId.value)
    })

    const notFound = computed(() => query.error.value?.response?.status === 404)
    const errorMessage = computed(() =>
        query.error.value && !notFound.value && !query.data.value ? getRecipientErrorMessage(query.error.value) : ''
    )

    // Put a saved recipient straight into the cache (e.g. after editing the profile)
    function setRecipient(updated) {
        queryClient.setQueryData(queryKeys.recipient(selectedFamilyId.value, updated._id), updated)
    }

    return {
        recipient: computed(() => query.data.value ?? null),
        isLoading: query.isLoading,
        notFound,
        errorMessage,
        refetch: query.refetch,
        setRecipient
    }
}
