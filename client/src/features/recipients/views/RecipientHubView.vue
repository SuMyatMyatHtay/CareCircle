<script setup>
// Owner: Jhen (C)
// Recipient hub shell at /recipients/:recipientId. Gets the recipient from the query cache
// and passes it to the tab views (Overview, Tasks, Profile) so they don't fetch it again.
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { useRecipient } from '../../../composables/useRecipients.js'
import RecipientHubHeader from '../components/RecipientHubHeader.vue'
import { displayName } from '../recipientLabels.js'

const route = useRoute()
const router = useRouter()
const { selectedFamilyId } = useActiveFamily()

const recipientId = computed(() => route.params.recipientId)

const TAB_LABELS = {
    'recipient-overview': 'Overview',
    'recipient-tasks': 'Tasks',
    'recipient-log': 'Log',
    'recipient-profile': 'Profile'
}

// Cached per recipient: each recipient has its own cache entry, so the previous
// one is never shown while another loads
const { recipient, isLoading: loading, notFound, errorMessage: error, refetch: loadRecipient, setRecipient } =
    useRecipient(recipientId)

// A recipient belongs to one family, so switching family leaves the hub
watch(selectedFamilyId, (newId, oldId) => {
    if (oldId && newId !== oldId) router.push('/home')
})

function replaceRecipient(updated) {
    setRecipient(updated)
}
</script>

<template>
    <div class="hub-page">
        <nav class="breadcrumb-row" aria-label="Breadcrumb">
            <RouterLink to="/home">Family home</RouterLink>
            <span aria-hidden="true">/</span>
            <span>{{ displayName(recipient) || 'Care recipient' }}</span>
            <template v-if="TAB_LABELS[route.name]">
                <span aria-hidden="true">/</span>
                <span class="current" aria-current="page">{{ TAB_LABELS[route.name] }}</span>
            </template>
        </nav>

        <div v-if="loading && !recipient" class="hub-status" role="status">
            <div class="spinner-border spinner-border-sm text-success" aria-hidden="true"></div>
            Loading care recipient...
        </div>

        <section v-else-if="notFound" class="hub-empty">
            <div class="hub-empty-icon" aria-hidden="true"><i class="bi bi-person-x"></i></div>
            <h2>We couldn't find this care recipient</h2>
            <p>They may have been archived, or they belong to a different family.</p>
            <RouterLink to="/home" class="back-home">Back to Family home</RouterLink>
        </section>

        <div v-else-if="error" class="hub-status is-error" role="alert">
            <span>{{ error }}</span>
            <button type="button" class="btn btn-sm btn-outline-secondary" @click="loadRecipient()">
                Try again
            </button>
        </div>

        <template v-else-if="recipient">
            <RecipientHubHeader :recipient="recipient" @updated="replaceRecipient" />

            <div class="hub-tab-content">
                <RouterView v-slot="{ Component }">
                    <!-- Crossfade between tabs. The wrapper gives each tab one element to fade. -->
                    <Transition name="care-fade" mode="out-in">
                        <div :key="route.name">
                            <!-- The Log tab is F's view; it loads its own data and takes no props -->
                            <component :is="Component" v-if="route.name === 'recipient-log'" />
                            <component :is="Component" v-else :recipient="recipient" @updated="replaceRecipient" />
                        </div>
                    </Transition>
                </RouterView>
            </div>
        </template>
    </div>
</template>

<style scoped>
.hub-page {
    max-width: 1180px;
}

.breadcrumb-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 20px;
    font-size: 14px;
    color: var(--theme-muted, #7B8391);
}

.breadcrumb-row a {
    color: var(--theme-muted, #7B8391);
    text-decoration: none;
}

.breadcrumb-row a:hover {
    color: var(--theme-green, #2E7D43);
    text-decoration: underline;
}

.breadcrumb-row .current {
    color: var(--theme-text, #2F2F2F);
    font-weight: 700;
}

.hub-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0;
    padding: 18px 4px;
    color: var(--theme-muted, #7B8391);
    font-size: 14px;
}

.hub-status.is-error {
    color: var(--theme-danger, #C0564B);
}

.hub-empty {
    max-width: 520px;
    margin: 40px auto 0;
    padding: 36px 24px;
    text-align: center;
    background: var(--theme-panel, white);
    border: 1px solid var(--theme-border, #E4ECE5);
    border-radius: 20px;
}

.hub-empty-icon {
    font-size: 40px;
    color: var(--theme-green, #A8D5B5);
}

.hub-empty h2 {
    margin: 8px 0;
    font-size: 22px;
    font-weight: 800;
}

.hub-empty p {
    color: var(--theme-muted, #7B8391);
}

.back-home {
    display: inline-block;
    padding: 11px 18px;
    border-radius: 10px;
    background: #2E7D43;
    color: white;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
}

/* F's log view has its own breadcrumb; the hub already shows one */
.hub-tab-content :deep(.log-page > .breadcrumb-row) {
    display: none;
}
</style>
