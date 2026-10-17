// Shared TanStack Query cache for data from the API.
// Every page reads server data through a query, so switching tabs or pages
// reuses what is already loaded instead of fetching it again.
//
// Rules for the whole app:
// - Data counts as fresh for 1 minute. While fresh, opening a page uses the cache
//   with no request. Once stale, the cached data shows straight away and a
//   background refetch quietly updates it.
// - Unused data is dropped from memory after 10 minutes.
// - Coming back to the browser tab refetches stale data.
// - 401/403/404 are not retried: retrying won't change the answer.
import { QueryClient } from '@tanstack/vue-query'

const NO_RETRY_STATUSES = [401, 403, 404]

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) =>
                !NO_RETRY_STATUSES.includes(error?.response?.status) && failureCount < 1
        }
    }
})

// Query keys. Everything for a family sits under ['families', familyId], so
// invalidating that prefix refreshes all of one family's data at once.
export const queryKeys = {
    family: (familyId) => ['families', familyId],
    tasks: (familyId) => ['families', familyId, 'tasks'],
    recipients: (familyId) => ['families', familyId, 'recipients'],
    recipientList: (familyId) => ['families', familyId, 'recipients', 'list'],
    recipient: (familyId, recipientId) => ['families', familyId, 'recipients', 'detail', recipientId],
    logs: (familyId) => ['families', familyId, 'logs'],
    recipientLogs: (familyId, recipientId, filters) => ['families', familyId, 'logs', recipientId, filters]
}
