<script setup>
// Owner: Jhen (C)
// Hub "Profile" tab: every detail about the recipient in three columns of cards.
// Each "Edit" opens the recipient form; admins can also archive the recipient here.
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { useRecipients } from '../../../composables/useRecipients.js'
import SectionCard from '../../../components/common/SectionCard.vue'
import RecipientFormModal from '../components/RecipientFormModal.vue'
import { archiveRecipient, getRecipientErrorMessage } from '../services/recipientsApi.js'
import { careTypeLabel, mobilityLabel, ageLabel, formatDate, initials } from '../recipientLabels.js'

const props = defineProps({
    recipient: { type: Object, required: true }
})

const emit = defineEmits(['updated'])

const router = useRouter()
const { selectedFamilyId, selectedFamily } = useActiveFamily()
const { refresh } = useRecipients()

function readUser() {
    try {
        return JSON.parse(sessionStorage.getItem('user') || '{}')
    } catch {
        return {}
    }
}
const user = readUser()

// Same check as FamilySidebar.vue's userRole
const isAdmin = computed(() =>
    selectedFamily.value?.members?.find((member) => member.userId === user.id)?.role === 'admin'
)

function memberName(userId) {
    return selectedFamily.value?.members?.find((member) => member.userId === userId)?.name || 'a family member'
}

const dateOfBirth = computed(() => {
    if (!props.recipient.dateOfBirth) return ''
    const age = ageLabel(props.recipient.dateOfBirth)
    return `${formatDate(props.recipient.dateOfBirth)}${age ? ` (${age})` : ''}`
})

// Most recent medication change, for "Updated by … · date"
const lastMedicationUpdate = computed(() => {
    const stamped = (props.recipient.medications || []).filter((m) => m.updatedBy && m.updatedAt)
    if (!stamped.length) return null
    const latest = stamped.reduce((a, b) => (new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b))
    return `Updated by ${memberName(latest.updatedBy)} · ${formatDate(latest.updatedAt, { day: 'numeric', month: 'short' })}`
})

const clinic = computed(() => props.recipient.preferredClinic)

const editing = ref(false)

// ---- Archive (admin only) ----
const isArchiving = ref(false)
const archiveError = ref('')

async function archive() {
    if (!window.confirm(`Archive ${props.recipient.nickname || props.recipient.name}? They'll be hidden from the family's lists. Their tasks and notes are kept.`)) return

    isArchiving.value = true
    archiveError.value = ''
    try {
        await archiveRecipient(selectedFamilyId.value, props.recipient._id)
        await refresh()
        router.push('/home')
    } catch (error) {
        archiveError.value = getRecipientErrorMessage(error)
    } finally {
        isArchiving.value = false
    }
}
</script>

<template>
    <div>
        <div class="row g-4">
            <div class="col-lg-4 d-flex flex-column gap-4">
                <SectionCard title="Basic info" class="profile-card">
                    <template #actions>
                        <button type="button" class="edit-link" @click="editing = true">Edit</button>
                    </template>
                    <dl class="info-rows">
                        <div>
                            <dt>Full name</dt>
                            <dd>{{ recipient.name }}</dd>
                        </div>
                        <div v-if="recipient.nickname">
                            <dt>Called</dt>
                            <dd>{{ recipient.nickname }}</dd>
                        </div>
                        <div v-if="dateOfBirth">
                            <dt>Date of birth</dt>
                            <dd>{{ dateOfBirth }}</dd>
                        </div>
                        <div>
                            <dt>Care type</dt>
                            <dd>{{ careTypeLabel(recipient.careType) }}</dd>
                        </div>
                    </dl>
                </SectionCard>

                <SectionCard title="Mobility" class="profile-card">
                    <template #actions>
                        <button type="button" class="edit-link" @click="editing = true">Edit</button>
                    </template>
                    <template v-if="recipient.mobility?.level || recipient.mobility?.notes">
                        <span v-if="recipient.mobility?.level" class="chip chip-green">
                            {{ mobilityLabel(recipient.mobility.level) }}
                        </span>
                        <p v-if="recipient.mobility?.notes" class="card-text mt-2">{{ recipient.mobility.notes }}</p>
                    </template>
                    <p v-else class="empty-text">Not added yet.</p>
                </SectionCard>

                <SectionCard v-if="recipient.linkedUser" title="Linked account" class="profile-card">
                    <p class="card-text">
                        <i class="bi bi-person-check text-success" aria-hidden="true"></i>
                        Has a CareCircle account: <strong>{{ recipient.linkedUser.name }}</strong>
                    </p>
                </SectionCard>
            </div>

            <div class="col-lg-4 d-flex flex-column gap-4">
                <SectionCard title="Allergies and conditions" class="profile-card">
                    <template #actions>
                        <button type="button" class="edit-link" @click="editing = true">Edit</button>
                    </template>
                    <div v-if="recipient.allergies?.length" class="chip-row">
                        <span v-for="allergy in recipient.allergies" :key="allergy.name" class="chip"
                            :class="allergy.severity === 'severe' ? 'chip-coral' : 'chip-muted'">
                            {{ allergy.name }} · {{ allergy.severity }}
                        </span>
                    </div>
                    <div v-if="recipient.conditions?.length" class="chip-row">
                        <span v-for="condition in recipient.conditions" :key="condition" class="chip chip-muted">
                            {{ condition }}
                        </span>
                    </div>
                    <p v-if="!recipient.allergies?.length && !recipient.conditions?.length" class="empty-text">
                        No allergies or conditions noted.
                    </p>
                </SectionCard>

                <SectionCard title="Medications" class="profile-card">
                    <template #actions>
                        <button type="button" class="edit-link" @click="editing = true">Edit</button>
                    </template>
                    <ul v-if="recipient.medications?.length" class="medication-list">
                        <li v-for="(medication, index) in recipient.medications" :key="index">
                            <strong>{{ [medication.name, medication.dosage].filter(Boolean).join(' · ') }}</strong>
                            <span v-if="medication.frequency">{{ medication.frequency }}</span>
                        </li>
                    </ul>
                    <p v-else class="empty-text">No medications.</p>
                    <p v-if="lastMedicationUpdate" class="small-note">{{ lastMedicationUpdate }}</p>
                </SectionCard>

                <SectionCard title="Diet" class="profile-card">
                    <template #actions>
                        <button type="button" class="edit-link" @click="editing = true">Edit</button>
                    </template>
                    <div v-if="recipient.dietaryRestrictions?.length" class="chip-row">
                        <span v-for="diet in recipient.dietaryRestrictions" :key="diet" class="chip chip-muted">{{ diet
                            }}</span>
                    </div>
                    <p v-else class="empty-text">No dietary restrictions.</p>
                </SectionCard>
            </div>

            <div class="col-lg-4 d-flex flex-column gap-4">
                <SectionCard title="Usual clinic" class="profile-card">
                    <template #actions>
                        <button type="button" class="edit-link" @click="editing = true">Change</button>
                    </template>
                    <template v-if="clinic?.name || clinic?.address">
                        <div class="map-placeholder" aria-hidden="true">
                            <i class="bi bi-geo-alt"></i>
                            <span>OneMap</span>
                        </div>
                        <p v-if="clinic.name" class="card-text fw-bold mb-1">{{ clinic.name }}</p>
                        <p v-if="clinic.address" class="card-text text-muted-soft">
                            {{ clinic.address }}<template v-if="clinic.postal">, S{{ clinic.postal }}</template>
                        </p>
                    </template>
                    <p v-else class="empty-text">No clinic chosen.</p>
                </SectionCard>

                <SectionCard title="Emergency contacts" class="profile-card">
                    <template #actions>
                        <button type="button" class="edit-link" @click="editing = true">Edit</button>
                    </template>
                    <ul v-if="recipient.emergencyContacts?.length" class="contact-list">
                        <li v-for="(contact, index) in recipient.emergencyContacts" :key="index">
                            <span class="contact-avatar" aria-hidden="true">{{ initials(contact.name) }}</span>
                            <span class="contact-text">
                                <strong>{{ contact.name }}<template v-if="contact.relationship"> · {{
                                        contact.relationship }}</template></strong>
                                <a :href="`tel:${contact.phone}`">{{ contact.phone }}</a>
                            </span>
                        </li>
                    </ul>
                    <p v-else class="empty-text">No emergency contacts.</p>
                </SectionCard>

                <SectionCard title="Care notes" class="profile-card care-notes-card">
                    <template #actions>
                        <button type="button" class="edit-link" @click="editing = true">Edit</button>
                    </template>
                    <p v-if="recipient.careNotes" class="card-text care-notes">{{ recipient.careNotes }}</p>
                    <p v-else class="empty-text">Routines, preferences, what calms them.</p>
                </SectionCard>
            </div>
        </div>

        <div v-if="isAdmin" class="archive-row">
            <p v-if="archiveError" class="archive-error" role="alert">{{ archiveError }}</p>
            <button type="button" class="archive-button" :disabled="isArchiving" @click="archive">
                <i class="bi bi-archive" aria-hidden="true"></i>
                {{ isArchiving ? 'Archiving...' : 'Archive recipient' }}
            </button>
        </div>

        <RecipientFormModal v-if="editing" :recipient="recipient" @updated="emit('updated', $event)"
            @close="editing = false" />
    </div>
</template>

<style scoped>
.section-card.profile-card {
    height: auto;
}

.section-card.care-notes-card {
    background: var(--theme-warning-soft, #FFF8E1);
    border-color: var(--theme-warning-border, #FFE6A3);
}

.edit-link {
    padding: 0;
    border: none;
    background: none;
    color: var(--theme-green, #2E7D43);
    font-size: 14px;
    font-weight: 700;
}

.edit-link:hover {
    text-decoration: underline;
}

.info-rows {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
}

.info-rows div {
    display: flex;
    gap: 12px;
    font-size: 14px;
}

.info-rows dt {
    flex: 0 0 110px;
    font-weight: 400;
    color: var(--theme-muted, #7B8391);
}

.info-rows dd {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-weight: 600;
    color: var(--theme-text, #2F2F2F);
    overflow-wrap: anywhere;
}

.card-text {
    margin: 0;
    font-size: 14px;
    color: var(--theme-text, #2F2F2F);
}

.text-muted-soft {
    color: var(--theme-muted, #7B8391);
}

.care-notes {
    white-space: pre-line;
}

.empty-text {
    margin: 0;
    font-size: 14px;
    color: var(--theme-muted, #7B8391);
}

.small-note {
    margin: 10px 0 0;
    font-size: 12px;
    color: var(--theme-muted, #7B8391);
}

.chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.chip-row+.chip-row {
    margin-top: 10px;
}

.chip {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
}

.chip-green {
    background: var(--theme-soft, #E8F5E9);
    color: var(--theme-green, #2E7D43);
}

.chip-muted {
    background: var(--theme-page, #F3F4F1);
    color: var(--theme-text, #2F2F2F);
}

.chip-coral {
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
}

.medication-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.medication-list li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--theme-page, #FBFBF7);
    font-size: 14px;
}

.medication-list span {
    font-size: 12px;
    color: var(--theme-muted, #7B8391);
}

.map-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 120px;
    margin-bottom: 12px;
    border-radius: 10px;
    background: var(--theme-soft, #E8F5E9);
    color: var(--theme-green, #2E7D43);
    font-size: 12px;
    font-weight: 700;
}

.map-placeholder .bi {
    font-size: 22px;
}

.contact-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.contact-list li {
    display: flex;
    align-items: center;
    gap: 10px;
}

.contact-avatar {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--theme-soft, #E8F5E9);
    color: var(--theme-green, #2E7D43);
    font-size: 12px;
    font-weight: 800;
}

.contact-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: 14px;
}

.contact-text a {
    font-size: 12px;
    color: var(--theme-muted, #7B8391);
}

.archive-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid var(--theme-border, #E4ECE5);
}

.archive-error {
    margin: 0;
    color: var(--theme-danger, #C0564B);
    font-size: 14px;
}

.archive-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 1px solid var(--theme-danger-border, #FFDAD0);
    border-radius: 10px;
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
    font-size: 14px;
    font-weight: 700;
}

.archive-button:hover:not(:disabled) {
    background: var(--theme-danger-soft, #FFE4DB);
}

.archive-button:disabled {
    opacity: 0.7;
}
</style>
