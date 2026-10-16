// Owner: SeungHak (F)

export const LOG_TYPES = [
    { value: 'consultation', label: 'Consultation', plural: 'Consultations' },
    { value: 'medication_change', label: 'Medication change', plural: 'Medication changes' },
    { value: 'diet', label: 'Diet', plural: 'Diet' },
    { value: 'symptom', label: 'Symptom', plural: 'Symptoms' },
    { value: 'general', label: 'General', plural: 'General' }
]

export function logTypeLabel(type) {
    return LOG_TYPES.find((t) => t.value === type)?.label || 'Update'
}

export const MEDICATION_CHANGE_LABELS = {
    added: 'Started',
    stopped: 'Stopped',
    dosage_changed: 'Dose changed'
}

export const LANGUAGE_LABELS = {
    en: 'English',
    zh: '中文',
    ms: 'Bahasa Melayu',
    ta: 'தமிழ்'
}

export function languageLabel(code) {
    return LANGUAGE_LABELS[code] || code.toUpperCase()
}
