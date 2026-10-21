<script setup>
// Owner: Jhen (C)
// Add / edit form for a care recipient. Pass a recipient to edit it; leave it out to create one.
//   <RecipientForm :recipient="recipient" @saved="onSaved" @cancel="close" />
import { ref, computed } from 'vue'
import ProfilePicturePicker from '../../../components/common/ProfilePicturePicker.vue'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { CARE_TYPES, MOBILITY_LEVELS, ALLERGY_SEVERITIES, dateKey } from '../recipientLabels.js'
import { createRecipient, updateRecipient, getRecipientErrorMessage } from '../services/recipientsApi.js'

const props = defineProps({
    recipient: { type: Object, default: null }
})

const emit = defineEmits(['saved', 'cancel'])

const { selectedFamilyId } = useActiveFamily()

const isEdit = computed(() => Boolean(props.recipient))

// ---- Form state, copied from the recipient so Cancel leaves it untouched ----
const source = props.recipient || {}

const profilePicture = ref(source.profilePicture || '')
const name = ref(source.name || '')
const nickname = ref(source.nickname || '')
const dateOfBirth = ref(source.dateOfBirth ? dateKey(source.dateOfBirth) : '')
const careType = ref(source.careType || '')
const mobilityLevel = ref(source.mobility?.level || '')
const mobilityNotes = ref(source.mobility?.notes || '')
const allergies = ref((source.allergies || []).map((a) => ({ name: a.name, severity: a.severity || 'mild' })))
const conditions = ref([...(source.conditions || [])])
const dietaryRestrictions = ref([...(source.dietaryRestrictions || [])])
// startDate and notes aren't shown, but are sent back so an edit doesn't wipe them
const medications = ref((source.medications || []).map((m) => ({
    name: m.name || '',
    dosage: m.dosage || '',
    frequency: m.frequency || '',
    startDate: m.startDate || null,
    notes: m.notes || ''
})))
const emergencyContacts = ref((source.emergencyContacts || []).map((c) => ({
    name: c.name || '',
    relationship: c.relationship || '',
    phone: c.phone || ''
})))
const clinicName = ref(source.preferredClinic?.name || '')
const clinicAddress = ref(source.preferredClinic?.address || '')
const careNotes = ref(source.careNotes || '')
const linkedUser = ref(source.linkedUser?._id || source.linkedUser || '')

const userId = (() => {
    try {
        return JSON.parse(sessionStorage.getItem('user') || '{}').id
    } catch {
        return ''
    }
})()

// You can only link yourself; a link to someone else can only be removed
const isInfant = computed(() => careType.value === 'infant')
const linkedToOther = computed(() => Boolean(linkedUser.value) && linkedUser.value !== userId)
const linkedOtherName = source.linkedUser?.name || 'another family member'
const linkMe = computed({
    get: () => linkedUser.value === userId,
    set: (checked) => { linkedUser.value = checked ? userId : '' }
})

// ---- Chip lists ----
const newAllergy = ref('')
const newAllergySeverity = ref('mild')
const newCondition = ref('')
const newDiet = ref('')

function addAllergy() {
    const value = newAllergy.value.trim()
    if (!value) return
    allergies.value.push({ name: value, severity: newAllergySeverity.value })
    newAllergy.value = ''
    newAllergySeverity.value = 'mild'
}

function addCondition() {
    const value = newCondition.value.trim()
    if (value && !conditions.value.includes(value)) conditions.value.push(value)
    newCondition.value = ''
}

function addDiet() {
    const value = newDiet.value.trim()
    if (value && !dietaryRestrictions.value.includes(value)) dietaryRestrictions.value.push(value)
    newDiet.value = ''
}

function toggleMobility(level) {
    mobilityLevel.value = mobilityLevel.value === level ? '' : level
}

// ---- Saving ----
const isSaving = ref(false)
const errorMessage = ref('')

function buildPayload() {
    const clinic = clinicName.value.trim() || clinicAddress.value.trim()
        ? { ...(source.preferredClinic || {}), name: clinicName.value, address: clinicAddress.value }
        : null

    return {
        profilePicture: profilePicture.value,
        name: name.value,
        nickname: nickname.value,
        careType: careType.value,
        dateOfBirth: dateOfBirth.value || null,
        mobility: mobilityLevel.value || mobilityNotes.value.trim()
            ? { ...(mobilityLevel.value ? { level: mobilityLevel.value } : {}), notes: mobilityNotes.value }
            : null,
        allergies: allergies.value,
        conditions: conditions.value,
        dietaryRestrictions: dietaryRestrictions.value,
        medications: medications.value.filter((m) => m.name.trim()),
        emergencyContacts: emergencyContacts.value.filter((c) => c.name.trim() || c.phone.trim()),
        preferredClinic: clinic,
        careNotes: careNotes.value,
        // Infant profiles are never linked (the server rejects it too)
        linkedUser: isInfant.value ? null : linkedUser.value || null
    }
}

async function save() {
    errorMessage.value = ''

    const missing = []
    if (!name.value.trim()) missing.push('Full name is required.')
    if (!careType.value) missing.push('Choose a care type.')
    if (missing.length) {
        errorMessage.value = missing.join(' ')
        return
    }

    isSaving.value = true
    try {
        const payload = buildPayload()
        const saved = isEdit.value
            ? await updateRecipient(selectedFamilyId.value, props.recipient._id, payload)
            : await createRecipient(selectedFamilyId.value, payload)
        emit('saved', saved)
    } catch (error) {
        errorMessage.value = getRecipientErrorMessage(error)
    } finally {
        isSaving.value = false
    }
}
</script>

<template>
    <form class="recipient-form" novalidate @submit.prevent="save">
        <ProfilePicturePicker v-model="profilePicture" :care-type="careType" :disabled="isSaving" />
        <div class="row g-3">
            <div class="col-md-4">
                <label class="field-label" for="recipient-name">Full name</label>
                <input id="recipient-name" v-model="name" class="form-control" maxlength="100"
                    placeholder="e.g. Lim Siew Lan" required>
            </div>
            <div class="col-md-4">
                <label class="field-label" for="recipient-nickname">What the family calls them</label>
                <input id="recipient-nickname" v-model="nickname" class="form-control" maxlength="50"
                    placeholder="e.g. Grandma">
            </div>
            <div class="col-md-4">
                <label class="field-label" for="recipient-dob">Date of birth</label>
                <input id="recipient-dob" v-model="dateOfBirth" type="date" class="form-control"
                    :max="dateKey(new Date())">
            </div>
        </div>

        <fieldset>
            <legend class="field-label">Care type</legend>
            <div class="chip-options">
                <button v-for="type in CARE_TYPES" :key="type.value" type="button" class="chip-option"
                    :class="{ selected: careType === type.value }" :aria-pressed="careType === type.value"
                    @click="careType = type.value">
                    {{ type.label }}
                </button>
            </div>
        </fieldset>

        <fieldset>
            <legend class="field-label">Mobility</legend>
            <div class="chip-options mb-2">
                <button v-for="level in MOBILITY_LEVELS" :key="level.value" type="button" class="chip-option"
                    :class="{ selected: mobilityLevel === level.value }" :aria-pressed="mobilityLevel === level.value"
                    @click="toggleMobility(level.value)">
                    {{ level.label }}
                </button>
            </div>
            <input v-model="mobilityNotes" class="form-control" maxlength="300" aria-label="Mobility notes"
                placeholder="Notes, e.g. walking stick, avoid stairs">
        </fieldset>

        <div class="row g-3">
            <div class="col-md-6">
                <span class="field-label">Allergies</span>
                <div class="chip-options mb-2">
                    <span v-for="(allergy, index) in allergies" :key="`${allergy.name}-${index}`" class="chip"
                        :class="allergy.severity === 'severe' ? 'chip-coral' : 'chip-muted'">
                        {{ allergy.name }} · {{ allergy.severity }}
                        <button type="button" :aria-label="`Remove ${allergy.name}`" @click="allergies.splice(index, 1)">
                            <i class="bi bi-x" aria-hidden="true"></i>
                        </button>
                    </span>
                </div>
                <div class="input-group input-group-sm">
                    <input v-model="newAllergy" class="form-control" maxlength="100" aria-label="New allergy"
                        placeholder="e.g. Penicillin" @keydown.enter.prevent="addAllergy">
                    <select v-model="newAllergySeverity" class="form-select severity-select" aria-label="Severity">
                        <option v-for="severity in ALLERGY_SEVERITIES" :key="severity" :value="severity">{{ severity }}</option>
                    </select>
                    <button type="button" class="btn btn-outline-secondary" @click="addAllergy">Add</button>
                </div>
            </div>

            <div class="col-md-6">
                <span class="field-label">Conditions</span>
                <div class="chip-options mb-2">
                    <span v-for="(condition, index) in conditions" :key="condition" class="chip chip-muted">
                        {{ condition }}
                        <button type="button" :aria-label="`Remove ${condition}`" @click="conditions.splice(index, 1)">
                            <i class="bi bi-x" aria-hidden="true"></i>
                        </button>
                    </span>
                </div>
                <div class="input-group input-group-sm">
                    <input v-model="newCondition" class="form-control" maxlength="100" aria-label="New condition"
                        placeholder="e.g. Hypertension" @keydown.enter.prevent="addCondition">
                    <button type="button" class="btn btn-outline-secondary" @click="addCondition">Add</button>
                </div>
            </div>

            <div class="col-md-6">
                <span class="field-label">Diet</span>
                <div class="chip-options mb-2">
                    <span v-for="(diet, index) in dietaryRestrictions" :key="diet" class="chip chip-muted">
                        {{ diet }}
                        <button type="button" :aria-label="`Remove ${diet}`" @click="dietaryRestrictions.splice(index, 1)">
                            <i class="bi bi-x" aria-hidden="true"></i>
                        </button>
                    </span>
                </div>
                <div class="input-group input-group-sm">
                    <input v-model="newDiet" class="form-control" maxlength="100" aria-label="New dietary restriction"
                        placeholder="e.g. Low sodium" @keydown.enter.prevent="addDiet">
                    <button type="button" class="btn btn-outline-secondary" @click="addDiet">Add</button>
                </div>
            </div>
        </div>

        <fieldset>
            <legend class="field-label">Medications</legend>
            <div v-for="(medication, index) in medications" :key="index" class="row-fields">
                <input v-model="medication.name" class="form-control" maxlength="100" aria-label="Medication name" placeholder="Name">
                <input v-model="medication.dosage" class="form-control" maxlength="100" aria-label="Dosage" placeholder="Dosage">
                <input v-model="medication.frequency" class="form-control" maxlength="100" aria-label="Frequency" placeholder="How often">
                <button type="button" class="remove-row" aria-label="Remove medication" @click="medications.splice(index, 1)">
                    <i class="bi bi-trash3" aria-hidden="true"></i>
                </button>
            </div>
            <button type="button" class="add-row"
                @click="medications.push({ name: '', dosage: '', frequency: '', startDate: null, notes: '' })">
                <i class="bi bi-plus-lg" aria-hidden="true"></i> Add medication
            </button>
        </fieldset>

        <fieldset>
            <legend class="field-label">Emergency contacts</legend>
            <div v-for="(contact, index) in emergencyContacts" :key="index" class="row-fields">
                <input v-model="contact.name" class="form-control" maxlength="100" aria-label="Contact name" placeholder="Name">
                <input v-model="contact.relationship" class="form-control" maxlength="50" aria-label="Relationship" placeholder="Relationship">
                <input v-model="contact.phone" class="form-control" maxlength="30" type="tel" aria-label="Phone" placeholder="+65 9000 0000">
                <button type="button" class="remove-row" aria-label="Remove contact" @click="emergencyContacts.splice(index, 1)">
                    <i class="bi bi-trash3" aria-hidden="true"></i>
                </button>
            </div>
            <button type="button" class="add-row" @click="emergencyContacts.push({ name: '', relationship: '', phone: '' })">
                <i class="bi bi-plus-lg" aria-hidden="true"></i> Add contact
            </button>
        </fieldset>

        <div class="row g-3">
            <div class="col-md-6">
                <label class="field-label" for="recipient-clinic">Preferred clinic</label>
                <input id="recipient-clinic" v-model="clinicName" class="form-control" maxlength="120"
                    placeholder="e.g. Ang Mo Kio Polyclinic">
            </div>
            <div class="col-md-6">
                <label class="field-label" for="recipient-clinic-address">Clinic address</label>
                <input id="recipient-clinic-address" v-model="clinicAddress" class="form-control" maxlength="200"
                    placeholder="e.g. 21 Ang Mo Kio Central 2">
            </div>
        </div>

        <div>
            <label class="field-label" for="recipient-notes">Care notes</label>
            <textarea id="recipient-notes" v-model="careNotes" class="form-control" rows="3" maxlength="2000"
                placeholder="Routines, preferences, what calms them"></textarea>
        </div>

        <div v-if="!isInfant">
            <span class="field-label">Linked account</span>
            <div v-if="linkedToOther" class="linked-other">
                <span>
                    <i class="bi bi-person-check" aria-hidden="true"></i>
                    Linked to {{ linkedOtherName }}'s account
                </span>
                <button type="button" class="unlink-button" @click="linkedUser = ''">Unlink</button>
            </div>
            <div v-else class="form-check">
                <input id="recipient-link-me" v-model="linkMe" class="form-check-input" type="checkbox">
                <label class="form-check-label" for="recipient-link-me">This is me (link to my account)</label>
            </div>
            <p class="field-hint">Only the person being cared for can link their own account, e.g. a pregnant family member.</p>
        </div>

        <p v-if="errorMessage" class="form-error" role="alert">
            <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
            {{ errorMessage }}
        </p>

        <div class="form-footer">
            <button type="button" class="btn-secondary-action" @click="emit('cancel')">Cancel</button>
            <button type="submit" class="btn-primary-action" :disabled="isSaving">
                <span v-if="isSaving" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                {{ isSaving ? 'Saving...' : 'Save recipient' }}
            </button>
        </div>
    </form>
</template>

<style scoped>
.recipient-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

fieldset {
    margin: 0;
}

.field-label {
    display: block;
    float: none;
    width: auto;
    margin-bottom: 6px;
    padding: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, #2F2F2F);
}

.field-hint {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--theme-muted, #7B8391);
}

.form-control,
.form-select {
    border-color: var(--theme-border, #E4ECE5);
    border-radius: 8px;
    font-size: 14px;
}

.form-control:focus,
.form-select:focus {
    border-color: var(--theme-accent-border, #A8D5B5);
    box-shadow: 0 0 0 3px #E8F5E9;
}

.input-group .form-control,
.input-group .form-select,
.input-group .btn {
    border-radius: 0;
}

.input-group > :first-child {
    border-radius: 8px 0 0 8px;
}

.input-group > :last-child {
    border-radius: 0 8px 8px 0;
}

.severity-select {
    flex: 0 0 96px;
}

.chip-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.chip-option,
.chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border: none;
    border-radius: 999px;
    background: var(--theme-page, #F3F4F1);
    color: var(--theme-text, #2F2F2F);
    font-size: 12px;
    font-weight: 600;
}

.chip-option:hover {
    background: var(--theme-neutral, #E8EBE6);
}

.chip-option.selected {
    background: #2F2F2F;
    color: white;
}

.chip-option:focus-visible {
    outline: 3px solid var(--theme-accent-border, #A8D5B5);
    outline-offset: 2px;
}

.chip-coral {
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
}

.chip button {
    display: inline-flex;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
}

.row-fields {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr auto;
    gap: 8px;
    margin-bottom: 8px;
}

.remove-row {
    padding: 0 10px;
    border: 1px solid var(--theme-border, #E4ECE5);
    border-radius: 8px;
    background: var(--theme-panel, white);
    color: var(--theme-danger, #C0564B);
}

.add-row {
    padding: 0;
    border: none;
    background: none;
    color: var(--theme-green, #2E7D43);
    font-size: 14px;
    font-weight: 700;
}

.form-error {
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

.form-footer {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 12px;
}

.btn-primary-action,
.btn-secondary-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
}

.btn-primary-action {
    border: none;
    background: #2E7D43;
    color: white;
}

.btn-primary-action:hover:not(:disabled) {
    background: #256836;
}

.btn-primary-action:disabled {
    opacity: 0.7;
}

.btn-secondary-action {
    border: 1px solid var(--theme-border, #E4ECE5);
    background: var(--theme-panel, white);
    color: var(--theme-text, #2F2F2F);
}

.linked-other {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--theme-soft, #E8F5E9);
    color: var(--theme-green, #2E7D43);
    font-size: 14px;
    font-weight: 600;
}

.unlink-button {
    padding: 0;
    border: none;
    background: none;
    color: var(--theme-danger, #C0564B);
    font-size: 14px;
    font-weight: 700;
}

.form-check-input:checked {
    border-color: var(--theme-accent-border, #2E7D43);
    background-color: #2E7D43;
}

.form-check-label {
    font-size: 14px;
}

@media (max-width: 575px) {
    .row-fields {
        grid-template-columns: 1fr 1fr;
    }

    .row-fields > :first-child {
        grid-column: 1 / -1;
    }
}
</style>
