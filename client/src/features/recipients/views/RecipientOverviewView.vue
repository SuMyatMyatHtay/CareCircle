<script setup>
// Owner: Jhen (C)
// Hub "Overview" tab: next tasks, latest notes, and what to know before taking them out.
// The hub passes in the loaded recipient; tasks and notes are loaded here.
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import SectionCard from '../../../components/common/SectionCard.vue'
import TaskList from '../../tasks/components/TaskList.vue'
import { getFamilyTasks, getTaskErrorMessage } from '../../tasks/services/tasksApi.js'
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

function isCurrent(familyId, forRecipient) {
    return familyId === selectedFamilyId.value && forRecipient === recipientId.value
}

// ---- Upcoming tasks (D's API) ----
const tasks = ref([])
const tasksLoading = ref(false)
const tasksError = ref('')

async function loadTasks() {
    const familyId = selectedFamilyId.value
    const forRecipient = recipientId.value
    tasksError.value = ''

    if (!familyId || !forRecipient) {
        tasks.value = []
        return
    }

    tasksLoading.value = true
    try {
        const result = await getFamilyTasks(familyId, {
            recipient: forRecipient,
            status: 'open,claimed,in_progress',
            from: new Date().toISOString()
        })
        if (isCurrent(familyId, forRecipient)) tasks.value = result.slice(0, 3)
    } catch (error) {
        if (isCurrent(familyId, forRecipient)) {
            tasks.value = []
            tasksError.value = getTaskErrorMessage(error)
        }
    } finally {
        if (isCurrent(familyId, forRecipient)) tasksLoading.value = false
    }
}

// ---- Latest notes (F's API) ----
const logs = ref([])
const logsLoading = ref(false)
const logsError = ref('')

async function loadLogs() {
    const familyId = selectedFamilyId.value
    const forRecipient = recipientId.value
    logsError.value = ''

    if (!familyId || !forRecipient) {
        logs.value = []
        return
    }

    logsLoading.value = true
    try {
        const result = await getLogs(familyId, { recipient: forRecipient, limit: 2 })
        if (isCurrent(familyId, forRecipient)) logs.value = result
    } catch (error) {
        if (isCurrent(familyId, forRecipient)) {
            logs.value = []
            logsError.value = getLogErrorMessage(error)
        }
    } finally {
        if (isCurrent(familyId, forRecipient)) logsLoading.value = false
    }
}

function loadAll() {
    loadTasks()
    loadLogs()
}

onMounted(loadAll)
watch([selectedFamilyId, recipientId], loadAll)

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
                    :empty-message="`Nothing coming up for ${name}.`" @retry="loadTasks" />
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
                    <button type="button" class="btn btn-sm btn-outline-secondary" @click="loadLogs">
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
    color: #2E7D43;
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
    color: #7B8391;
    font-size: 14px;
}

.list-status.is-error {
    color: #C0564B;
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
    background: #E8F5E9;
    color: #2E7D43;
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
    background: #F3F4F1;
    color: #5D6B7A;
    font-size: 12px;
    font-weight: 600;
}

/* Same colours as F's LogCard */
.type-consultation { background: #EEE8FA; color: #6A4FA3; }
.type-medication_change { background: #FFF3D6; color: #93650A; }
.type-diet { background: #EAF4EC; color: #3B7A4F; }
.type-symptom { background: #FBE9F2; color: #A3456F; }

.note-date {
    font-size: 12px;
    color: #7B8391;
}

.note-content {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    font-size: 14px;
    color: #2F2F2F;
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
    color: #7B8391;
}

.essentials dd {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: #2F2F2F;
}

.essentials dd.is-alert {
    color: #C0564B;
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
    background: #FBFBF7;
}

.medication-list span {
    color: #7B8391;
    font-weight: 400;
}
</style>
