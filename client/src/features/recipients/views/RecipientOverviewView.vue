<script setup>
// Owner: Jhen (C)
// Hub "Overview" tab: next tasks, latest notes, and what to know before taking them out.
// The hub passes in the loaded recipient. Tasks and notes come from the query cache,
// so coming back to this tab shows them straight away instead of refetching.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { useFamilyTasks, taskRecipientId } from '../../../composables/useFamilyTasks.js'
import { queryKeys } from '../../../services/queryClient.js'
import SectionCard from '../../../components/common/SectionCard.vue'
import TaskList from '../../tasks/components/TaskList.vue'
import { getLogs, getLogErrorMessage } from '../../logs/services/logsApi.js'
import { logTypeLabel } from '../../logs/logTypes.js'
import { displayName, initials, mobilityLabel, formatDate } from '../recipientLabels.js'

const props = defineProps({
    recipient: { type: Object, required: true }
})

defineEmits(['updated'])

const route = useRoute()
const { selectedFamilyId } = useActiveFamily()

const recipientId = computed(() => route.params.recipientId)
const name = computed(() => displayName(props.recipient))

// ---- Upcoming tasks (D): next 3 still-active tasks from the family's cached list ----
const ACTIVE_STATUSES = ['open', 'claimed', 'in_progress']
const { tasks: familyTasks, isLoading: tasksLoading, errorMessage: tasksError, refetch: reloadTasks } = useFamilyTasks()

const tasks = computed(() => {
    const now = Date.now()
    return familyTasks.value
        .filter((t) =>
            taskRecipientId(t) === recipientId.value &&
            ACTIVE_STATUSES.includes(t.status) &&
            new Date(t.startAt).getTime() >= now
        )
        .slice(0, 3)
})

// ---- Latest notes (F's API): the 2 newest, cached per recipient ----
const LOG_FILTERS = { limit: 2 }
const logsQuery = useQuery({
    queryKey: computed(() => queryKeys.recipientLogs(selectedFamilyId.value, recipientId.value, LOG_FILTERS)),
    queryFn: ({ queryKey }) => getLogs(queryKey[1], { recipient: queryKey[3], ...LOG_FILTERS }),
    enabled: computed(() => Boolean(selectedFamilyId.value && recipientId.value))
})

const logs = computed(() => logsQuery.data.value ?? [])
const logsLoading = logsQuery.isLoading
const logsError = computed(() =>
    logsQuery.error.value && !logsQuery.data.value ? getLogErrorMessage(logsQuery.error.value) : ''
)

// ---- "Before you take them out" ----
const mobility = computed(() =>
    props.recipient.mobility?.notes || mobilityLabel(props.recipient.mobility?.level)
)
const allergies = computed(() =>
    (props.recipient.allergies || []).map((a) => `${a.name} (${a.severity})`).join(', ')
)
const hasSevereAllergy = computed(() =>
    (props.recipient.allergies || []).some((a) => a.severity === 'severe')
)
const conditions = computed(() => (props.recipient.conditions || []).join(', '))
const diet = computed(() => (props.recipient.dietaryRestrictions || []).join(', '))
const medications = computed(() => props.recipient.medications || [])
const contact = computed(() => props.recipient.emergencyContacts?.[0] || null)

const hasEssentials = computed(() =>
    Boolean(mobility.value || allergies.value || conditions.value || diet.value || medications.value.length || contact.value)
)
</script>

<template>
    <div class="row g-4">
        <div class="col-lg-8 d-flex flex-column gap-4">
            <SectionCard title="Upcoming">
                <template #actions>
                    <RouterLink class="card-link" :to="{ name: 'recipient-tasks', params: { recipientId } }">
                        See all tasks <i class="bi bi-arrow-right" aria-hidden="true"></i>
                    </RouterLink>
                </template>
                <TaskList :tasks="tasks" :is-loading="tasksLoading" :error-message="tasksError"
                    :empty-message="`Nothing coming up for ${name}.`" @retry="reloadTasks" />
            </SectionCard>

            <SectionCard title="Latest notes">
                <template #actions>
                    <RouterLink class="card-link" :to="{ name: 'recipient-log', params: { recipientId } }">
                        Open log <i class="bi bi-arrow-right" aria-hidden="true"></i>
                    </RouterLink>
                </template>

                <div v-if="logsLoading" class="list-status" role="status">
                    <div class="spinner-border spinner-border-sm text-success" aria-hidden="true"></div>
                    Loading notes...
                </div>

                <div v-else-if="logsError" class="list-status is-error" role="alert">
                    <span>{{ logsError }}</span>
                    <button type="button" class="btn btn-sm btn-outline-secondary" @click="logsQuery.refetch()">
                        Try again
                    </button>
                </div>

                <p v-else-if="logs.length === 0" class="list-status">
                    No notes yet. Add one from the Log tab.
                </p>

                <ul v-else class="note-list">
                    <li v-for="log in logs" :key="log._id" class="note">
                        <span class="note-avatar" aria-hidden="true">{{ initials(log.author?.name || '?') }}</span>
                        <div class="note-body">
                            <div class="note-meta">
                                <strong>{{ log.author?.name || 'Family member' }}</strong>
                                <span class="type-chip" :class="`type-${log.type}`">{{ logTypeLabel(log.type) }}</span>
                                <span class="note-date">{{ formatDate(log.createdAt, { day: 'numeric', month: 'short' }) }}</span>
                            </div>
                            <p class="note-content">{{ log.content }}</p>
                        </div>
                    </li>
                </ul>
            </SectionCard>
        </div>

        <div class="col-lg-4">
            <SectionCard :title="`Before you take ${name} out`">
                <p v-if="!hasEssentials" class="list-status">
                    Nothing noted yet. Add details from the Profile tab.
                </p>

                <dl v-else class="essentials">
                    <div v-if="mobility">
                        <dt>Mobility</dt>
                        <dd>{{ mobility }}</dd>
                    </div>
                    <div v-if="allergies">
                        <dt>Allergies</dt>
                        <dd :class="{ 'is-alert': hasSevereAllergy }">{{ allergies }}</dd>
                    </div>
                    <div v-if="conditions">
                        <dt>Conditions</dt>
                        <dd>{{ conditions }}</dd>
                    </div>
                    <div v-if="diet">
                        <dt>Diet</dt>
                        <dd>{{ diet }}</dd>
                    </div>
                    <div v-if="medications.length">
                        <dt>Medications</dt>
                        <dd>
                            <ul class="medication-list">
                                <li v-for="(medication, index) in medications" :key="index">
                                    <strong>{{ [medication.name, medication.dosage].filter(Boolean).join(' ') }}</strong>
                                    <span v-if="medication.frequency">{{ medication.frequency }}</span>
                                </li>
                            </ul>
                        </dd>
                    </div>
                    <div v-if="contact">
                        <dt>Emergency contact</dt>
                        <dd>
                            {{ contact.name }}<template v-if="contact.relationship"> ({{ contact.relationship.toLowerCase() }})</template>
                            · <a :href="`tel:${contact.phone}`">{{ contact.phone }}</a>
                        </dd>
                    </div>
                </dl>
            </SectionCard>
        </div>
    </div>
</template>

<style scoped>
.card-link {
    color: var(--theme-green, #2E7D43);
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
}

.card-link:hover {
    text-decoration: underline;
}

.list-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0;
    padding: 18px 4px;
    color: var(--theme-muted, #7B8391);
    font-size: 14px;
}

.list-status.is-error {
    color: var(--theme-danger, #C0564B);
}

.note-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.note {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.note-avatar {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--theme-soft, #E8F5E9);
    color: var(--theme-green, #2E7D43);
    font-size: 13px;
    font-weight: 800;
}

.note-body {
    flex: 1;
    min-width: 0;
}

.note-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 14px;
}

.type-chip {
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--theme-page, #F3F4F1);
    color: var(--theme-muted, #5D6B7A);
    font-size: 12px;
    font-weight: 600;
}

/* Same colours as F's LogCard */
.type-consultation { background: var(--theme-purple-soft, #EEE8FA); color: var(--theme-purple, #6A4FA3); }
.type-medication_change { background: var(--theme-warning-soft, #FFF3D6); color: var(--theme-warning, #93650A); }
.type-diet { background: var(--theme-soft, #EAF4EC); color: var(--theme-green, #3B7A4F); }
.type-symptom { background: var(--theme-pink-soft, #FBE9F2); color: var(--theme-pink, #A3456F); }

.note-date {
    font-size: 12px;
    color: var(--theme-muted, #7B8391);
}

.note-content {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    font-size: 14px;
    color: var(--theme-text, #2F2F2F);
}

.essentials {
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin: 0;
}

.essentials dt {
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-muted, #7B8391);
}

.essentials dd {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--theme-text, #2F2F2F);
}

.essentials dd.is-alert {
    color: var(--theme-danger, #C0564B);
}

.essentials a {
    color: inherit;
}

.medication-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
}

.medication-list li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--theme-page, #FBFBF7);
}

.medication-list span {
    color: var(--theme-muted, #7B8391);
    font-weight: 400;
}
</style>
