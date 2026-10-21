<script setup>
// Owner: SeungHak (F)
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { LOG_TYPES, MEDICATION_CHANGE_LABELS } from '../logTypes.js'
import { speechInput } from '../services/speechInput.js'

const props = defineProps({
    recipientName: { type: String, default: '' },
    initialLog: { type: Object, default: null },
    isSaving: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    voice: { type: Object, default: () => speechInput }
})

const emit = defineEmits(['submit', 'cancel'])

const MAX_CONTENT = 5000
const isEdit = computed(() => Boolean(props.initialLog))

const type = ref('consultation')
const content = ref('')
const doctorName = ref('')
const clinic = ref('')
const nextAppointment = ref('')
const medications = ref([])
const inputMethod = ref('text')
const notifyFamily = ref(true)
const attempted = ref(false)

function toLocalInput(iso) {
    if (!iso) return ''
    const date = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyMedication() {
    return { name: '', change: 'added', details: '' }
}

function fillFrom(log) {
    type.value = log?.type || 'consultation'
    content.value = log?.content || ''
    doctorName.value = log?.consultation?.doctorName || ''
    clinic.value = log?.consultation?.clinic || ''
    nextAppointment.value = toLocalInput(log?.consultation?.nextAppointment)
    medications.value = log?.medicationChanges?.length
        ? log.medicationChanges.map((m) => ({ name: m.name, change: m.change, details: m.details || '' }))
        : []
    inputMethod.value = log?.inputMethod || 'text'
    notifyFamily.value = true
    attempted.value = false
}

watch(() => props.initialLog, fillFrom, { immediate: true })

watch(type, (value) => {
    if (value === 'medication_change' && medications.value.length === 0) {
        medications.value.push(emptyMedication())
    }
}, { immediate: true })

function addMedication() {
    medications.value.push(emptyMedication())
}

function removeMedication(index) {
    medications.value.splice(index, 1)
}

const contentError = computed(() => {
    if (!content.value.trim()) return 'Please write a short note.'
    if (content.value.length > MAX_CONTENT) return `Keep the note under ${MAX_CONTENT} characters.`
    return ''
})

const filledMedications = computed(() =>
    medications.value.filter((m) => m.name.trim() || m.details.trim())
)
const medicationError = computed(() => {
    if (type.value !== 'medication_change') return ''
    if (filledMedications.value.some((m) => !m.name.trim())) return 'Each medication needs a name.'
    return ''
})

const heading = computed(() => {
    if (isEdit.value) return 'Edit note'
    return props.recipientName ? `Add an update for ${props.recipientName}` : 'Add an update'
})

function buildPayload() {
    const payload = {
        type: type.value,
        content: content.value.trim(),
        medicationChanges: type.value === 'medication_change'
            ? filledMedications.value.map((m) => ({ name: m.name.trim(), change: m.change, details: m.details.trim() }))
            : []
    }

    if (type.value === 'consultation') {
        payload.consultation = {
            doctorName: doctorName.value.trim(),
            clinic: clinic.value.trim(),
            nextAppointment: nextAppointment.value ? new Date(nextAppointment.value).toISOString() : null
        }
    }

    if (!isEdit.value) {
        payload.inputMethod = inputMethod.value
        payload.notify = notifyFamily.value
    }

    return payload
}

function submit() {
    attempted.value = true
    if (contentError.value || medicationError.value || props.isSaving) return
    emit('submit', buildPayload())
}

const voiceState = ref('idle')
const voiceError = ref('')

const voiceLabel = computed(() => ({
    idle: 'Speak your note',
    listening: 'Stop and use what I said',
    transcribing: 'Turning speech into text'
})[voiceState.value])

async function toggleVoice() {
    voiceError.value = ''

    if (voiceState.value === 'idle') {
        try {
            await props.voice.start()
            voiceState.value = 'listening'
        } catch (error) {
            voiceError.value = error.message || 'Could not start the microphone.'
        }
        return
    }

    if (voiceState.value === 'listening') {
        voiceState.value = 'transcribing'
        try {
            const transcript = (await props.voice.stop()).trim()
            if (transcript) {
                content.value = content.value.trim() ? `${content.value.trim()} ${transcript}` : transcript
                inputMethod.value = 'voice'
            } else {
                voiceError.value = "We didn't catch that. Please try again."
            }
        } catch (error) {
            voiceError.value = error.message || 'Could not turn your voice into text.'
        } finally {
            voiceState.value = 'idle'
        }
    }
}

function cancelVoice() {
    if (voiceState.value === 'listening') props.voice.cancel()
    voiceState.value = 'idle'
}

onBeforeUnmount(cancelVoice)

function reset() {
    cancelVoice()
    voiceError.value = ''
    fillFrom(null)
    if (type.value === 'medication_change') medications.value.push(emptyMedication())
}

defineExpose({ reset })
</script>

<template>
    <form class="log-form" :class="{ 'is-edit': isEdit }" novalidate data-testid="log-form" @submit.prevent="submit">
        <h2 class="form-title">
            <i class="bi" :class="isEdit ? 'bi-pencil-square' : 'bi-journal-plus'" aria-hidden="true"></i>
            {{ heading }}
        </h2>

        <div class="type-chips" role="radiogroup" aria-label="Type of note">
            <button
                v-for="option in LOG_TYPES"
                :key="option.value"
                type="button"
                role="radio"
                class="type-chip"
                :class="{ 'is-selected': type === option.value }"
                :aria-checked="type === option.value"
                :data-testid="`log-type-${option.value}`"
                @click="type = option.value"
            >
                {{ option.label }}
            </button>
        </div>

        <label class="visually-hidden" :for="isEdit ? `log-content-${initialLog._id}` : 'log-content'">Note</label>
        <div class="content-wrap" :class="{ 'has-voice': !isEdit }">
            <textarea
                :id="isEdit ? `log-content-${initialLog._id}` : 'log-content'"
                v-model="content"
                class="content-input"
                :class="{ 'is-invalid': attempted && contentError }"
                rows="3"
                :maxlength="MAX_CONTENT"
                :readonly="voiceState !== 'idle'"
                :placeholder="voiceState === 'listening'
                    ? 'Listening... tap the microphone again when you are done.'
                    : 'What happened? e.g. what the doctor said, a change in diet, a new symptom'"
                data-testid="log-content"
            ></textarea>

            <button
                v-if="!isEdit"
                type="button"
                class="voice-button"
                :class="`is-${voiceState}`"
                :disabled="voiceState === 'transcribing' || isSaving"
                :aria-label="voiceLabel"
                :aria-pressed="voiceState === 'listening'"
                :title="voiceLabel"
                data-testid="log-voice"
                @click="toggleVoice"
            >
                <span v-if="voiceState === 'transcribing'" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <i v-else class="bi" :class="voiceState === 'listening' ? 'bi-stop-fill' : 'bi-mic-fill'" aria-hidden="true"></i>
            </button>
        </div>

        <p v-if="voiceState === 'listening'" class="voice-status" role="status">
            <span class="rec-dot" aria-hidden="true"></span> Listening... tap
            <i class="bi bi-stop-fill" aria-hidden="true"></i> when you're done.
            <button type="button" class="voice-cancel" @click="cancelVoice">Cancel</button>
        </p>
        <p v-else-if="voiceState === 'transcribing'" class="voice-status" role="status">
            Turning your voice into text...
        </p>
        <p v-else-if="inputMethod === 'voice' && !isEdit" class="voice-status is-done">
            <i class="bi bi-mic" aria-hidden="true"></i> Added from voice. Check the text before posting.
        </p>
        <p v-if="voiceError" class="field-error" role="alert">{{ voiceError }}</p>
        <p v-if="attempted && contentError" class="field-error">{{ contentError }}</p>

        <div v-if="type === 'consultation'" class="extra-fields">
            <div class="extra-field">
                <label for="log-doctor">Doctor <span class="optional">optional</span></label>
                <input id="log-doctor" v-model="doctorName" type="text" maxlength="100" placeholder="e.g. Dr Lim">
            </div>
            <div class="extra-field">
                <label for="log-clinic">Clinic <span class="optional">optional</span></label>
                <input id="log-clinic" v-model="clinic" type="text" maxlength="120" placeholder="e.g. Ang Mo Kio Polyclinic">
            </div>
            <div class="extra-field">
                <label for="log-next">Next appointment <span class="optional">optional</span></label>
                <input id="log-next" v-model="nextAppointment" type="datetime-local">
            </div>
        </div>

        <div v-if="type === 'medication_change'" class="medications">
            <div v-for="(med, index) in medications" :key="index" class="medication-row">
                <i class="bi bi-capsule" aria-hidden="true"></i>
                <input
                    v-model="med.name"
                    type="text"
                    maxlength="100"
                    placeholder="Medicine"
                    :aria-label="`Medicine ${index + 1} name`"
                    class="med-name"
                >
                <select v-model="med.change" :aria-label="`Medicine ${index + 1} change`" class="med-change">
                    <option v-for="(label, value) in MEDICATION_CHANGE_LABELS" :key="value" :value="value">
                        {{ label }}
                    </option>
                </select>
                <input
                    v-model="med.details"
                    type="text"
                    maxlength="300"
                    placeholder="e.g. 5mg to 10mg, once daily"
                    :aria-label="`Medicine ${index + 1} details`"
                    class="med-details"
                >
                <button
                    type="button"
                    class="remove-med"
                    :aria-label="`Remove medicine ${index + 1}`"
                    @click="removeMedication(index)"
                >
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
            </div>
            <button type="button" class="add-med" @click="addMedication">
                <i class="bi bi-plus-lg" aria-hidden="true"></i> Add medicine
            </button>
            <p v-if="attempted && medicationError" class="field-error">{{ medicationError }}</p>
        </div>

        <p v-if="errorMessage" class="form-error" role="alert">
            <i class="bi bi-exclamation-circle" aria-hidden="true"></i> {{ errorMessage }}
        </p>

        <div class="form-footer">
            <label v-if="!isEdit" class="notify-option">
                <input v-model="notifyFamily" type="checkbox" data-testid="log-notify">
                Notify the family Telegram group
            </label>
            <button v-if="isEdit" type="button" class="cancel-button" :disabled="isSaving" @click="emit('cancel')">
                Cancel
            </button>
            <button type="submit" class="submit-button" :disabled="isSaving" data-testid="log-submit">
                <span v-if="isSaving" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                {{ isSaving ? 'Saving...' : isEdit ? 'Save changes' : 'Post update' }}
            </button>
        </div>
    </form>
</template>

<style scoped>
.log-form {
    padding: 18px 20px;
    background: var(--theme-panel, white);
    border: 1.5px solid var(--theme-accent-border, #B5DDC0);
    border-radius: 16px;
}

.log-form.is-edit {
    border-color: var(--theme-border, #E4ECE5);
    background: var(--theme-soft, #FBFDFB);
}

.form-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 800;
    color: var(--theme-text, #2F2F2F);
}

.form-title .bi {
    color: var(--theme-green, #3B7A4F);
}

.type-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
}

.type-chip {
    padding: 5px 12px;
    border: none;
    border-radius: 999px;
    background: var(--theme-page, #F1F3F2);
    color: var(--theme-text, #4A4F57);
    font-size: 13px;
    font-weight: 700;
}

.type-chip:hover {
    background: var(--theme-neutral, #E6EAE7);
}

.type-chip.is-selected {
    background: #2F3A33;
    color: white;
}

.content-input,
.extra-field input,
.medication-row input,
.medication-row select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--theme-border, #DDE5DF);
    border-radius: 10px;
    background: var(--theme-page, #FAFBFA);
    color: var(--theme-text, #2F2F2F);
    font-size: 15px;
}

.content-input {
    resize: vertical;
    min-height: 84px;
}

.content-input:focus,
.extra-field input:focus,
.medication-row input:focus,
.medication-row select:focus {
    outline: none;
    border-color: var(--theme-accent-border, #6DBF7C);
    background: var(--theme-panel, white);
    box-shadow: 0 0 0 3px rgba(109, 191, 124, 0.18);
}

.content-input.is-invalid {
    border-color: var(--theme-danger-border, #E0A49B);
}

.content-wrap {
    position: relative;
}

.content-wrap.has-voice .content-input {
    padding-right: 56px;
}

.voice-button {
    position: absolute;
    right: 10px;
    bottom: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 50%;
    background: var(--theme-danger-soft, #FBE3DE);
    color: var(--theme-danger, #C0564B);
    font-size: 17px;
    transition: background 0.15s ease, transform 0.15s ease;
}

.voice-button:hover:not(:disabled) {
    background: var(--theme-danger-soft, #F7D2CA);
}

.voice-button:focus-visible {
    outline: 3px solid rgba(192, 86, 75, 0.35);
    outline-offset: 2px;
}

.voice-button.is-listening {
    background: #C0564B;
    color: white;
    animation: voice-pulse 1.4s ease-out infinite;
}

.voice-button:disabled {
    opacity: 0.7;
}

@keyframes voice-pulse {
    0% { box-shadow: 0 0 0 0 rgba(192, 86, 75, 0.45); }
    100% { box-shadow: 0 0 0 12px rgba(192, 86, 75, 0); }
}

@media (prefers-reduced-motion: reduce) {
    .voice-button.is-listening {
        animation: none;
    }
}

.voice-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--theme-danger, #C0564B);
}

.voice-status.is-done {
    color: var(--theme-green, #3B7A4F);
}

.rec-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #C0564B;
}

.voice-cancel {
    margin-left: auto;
    border: none;
    background: transparent;
    color: var(--theme-muted, #7B8391);
    font-size: 13px;
    font-weight: 700;
    text-decoration: underline;
}

.field-error,
.form-error {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--theme-danger, #C0564B);
}

.form-error {
    display: flex;
    gap: 6px;
    margin-top: 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--theme-danger-soft, #FFF0EB);
}

.extra-fields {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 12px;
}

.extra-field label {
    display: block;
    margin-bottom: 4px;
    font-size: 13px;
    font-weight: 700;
    color: var(--theme-text, #4A4F57);
}

.optional {
    font-weight: 400;
    color: var(--theme-muted, #9AA1AB);
}

.medications {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--theme-warning-soft, #FFF8E6);
}

.medication-row {
    display: grid;
    grid-template-columns: auto 1.2fr 0.9fr 1.6fr auto;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.medication-row .bi-capsule {
    color: var(--theme-warning, #93650A);
}

.medication-row input,
.medication-row select {
    padding: 7px 10px;
    font-size: 14px;
    background: var(--theme-panel, white);
}

.remove-med,
.add-med {
    border: none;
    background: transparent;
    color: var(--theme-warning, #93650A);
    font-size: 14px;
    font-weight: 700;
}

.remove-med {
    width: 32px;
    height: 32px;
    border-radius: 8px;
}

.remove-med:hover,
.add-med:hover {
    background: var(--theme-warning-soft, #FFEDBF);
}

.add-med {
    padding: 4px 8px;
    border-radius: 8px;
}

.notify-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-right: auto;
    font-size: 14px;
    color: var(--theme-text, #4A4F57);
    cursor: pointer;
}

.notify-option input {
    width: 16px;
    height: 16px;
    accent-color: var(--theme-green, #3B7A4F);
}

.form-footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
}

.submit-button,
.cancel-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 800;
}

.submit-button {
    border: none;
    background: #3B7A4F;
    color: white;
}

.submit-button:hover:not(:disabled) {
    background: #2E6640;
}

.cancel-button {
    border: 1px solid var(--theme-border, #DDE5DF);
    background: var(--theme-panel, white);
    color: var(--theme-text, #4A4F57);
}

.submit-button:disabled,
.cancel-button:disabled {
    opacity: 0.6;
}

@media (max-width: 767px) {
    .extra-fields {
        grid-template-columns: 1fr;
    }

    .medication-row {
        grid-template-columns: auto 1fr auto;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--theme-warning-border, #FBE6B5);
    }

    .medication-row .med-name,
    .medication-row .med-change,
    .medication-row .med-details {
        grid-column: 2;
    }

    .medication-row .remove-med {
        grid-column: 3;
        grid-row: 1;
    }

    .notify-option {
        width: 100%;
    }

    .form-footer .submit-button {
        flex: 1;
        justify-content: center;
    }
}
</style>
