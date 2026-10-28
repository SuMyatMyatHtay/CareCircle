<script setup>
// Owner: SeungHak (F)
import { computed, ref, watch, onUnmounted } from 'vue'
import { logTypeLabel, MEDICATION_CHANGE_LABELS, LANGUAGE_LABELS, languageLabel } from '../logTypes.js'

const props = defineProps({
    log: { type: Object, required: true },
    canChange: { type: Boolean, default: false },
    translate: { type: Function, default: null },
    // Narrow columns (the task pages): icon-only buttons so they fit beside the name
    compact: { type: Boolean, default: false }
})

const emit = defineEmits(['edit', 'delete'])

const TIME_ZONE = 'Asia/Singapore'

function formatDate(value, withTime = false) {
    if (!value) return ''
    return new Date(value).toLocaleString('en-SG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
        timeZone: TIME_ZONE
    })
}

const authorName = computed(() => props.log.author?.name || 'Family member')

const initials = computed(() =>
    authorName.value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
)

const context = computed(() => {
    const parts = []
    if (props.log.type === 'consultation' && props.log.consultation?.clinic) {
        parts.push(props.log.consultation.clinic)
    }
    if (props.log.inputMethod === 'voice') parts.push('voice note')
    return parts.join(' · ')
})

const consultation = computed(() => {
    const c = props.log.consultation
    if (props.log.type !== 'consultation' || !c) return null
    if (!c.doctorName && !c.nextAppointment) return null
    return c
})

const fetchedTranslations = ref({})
const shownLanguage = ref('')
const menuOpen = ref(false)
const translatingTo = ref('')
const translateError = ref('')
let translationVersion = 0

watch([() => props.log._id, () => props.log.content], () => {
    translationVersion++
    fetchedTranslations.value = {}
    shownLanguage.value = ''
    translatingTo.value = ''
    translateError.value = ''
    menuOpen.value = false
})
onUnmounted(() => { translationVersion++ })

const translations = computed(() => ({ ...(props.log.translations || {}), ...fetchedTranslations.value }))

const languageOptions = computed(() =>
    Object.keys(LANGUAGE_LABELS)
        .filter((code) => code !== (props.log.originalLang || 'en'))
        .map((code) => ({ code, label: languageLabel(code), cached: Boolean(translations.value[code]) }))
)

function onTranslateButton() {
    translateError.value = ''
    if (shownLanguage.value) {
        shownLanguage.value = ''
        return
    }
    menuOpen.value = !menuOpen.value
}

async function chooseLanguage(code) {
    const current = ++translationVersion
    menuOpen.value = false
    translateError.value = ''

    if (translations.value[code]) {
        shownLanguage.value = code
        return
    }

    if (!props.translate) return

    translatingTo.value = code
    try {
        const text = await props.translate(props.log, code)
        if (current !== translationVersion) return
        fetchedTranslations.value = { ...fetchedTranslations.value, [code]: text }
        shownLanguage.value = code
    } catch (error) {
        if (current === translationVersion)
            translateError.value = error.message || 'Could not translate this note. Please try again.'
    } finally {
        if (current === translationVersion) translatingTo.value = ''
    }
}

const translateLabel = computed(() => {
    if (translatingTo.value) return 'Translating...'
    return shownLanguage.value ? `Showing ${languageLabel(shownLanguage.value)}. Show the original` : 'Translate'
})

function closeMenuOnFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) menuOpen.value = false
}
</script>

<template>
    <article class="log-card" :class="{ 'is-compact': compact }" :data-testid="`log-card-${log._id}`">
        <header class="log-head">
            <span class="author-avatar" aria-hidden="true">{{ initials }}</span>

            <div class="log-meta">
                <span class="author-name">{{ authorName }}</span>
                <span class="type-badge" :class="`type-${log.type}`">{{ logTypeLabel(log.type) }}</span>
                <span class="log-when">
                    <time :datetime="log.createdAt">{{ formatDate(log.createdAt) }}</time>
                    <template v-if="context"> · {{ context }}</template>
                </span>
            </div>

            <div class="log-actions">
                <div class="translate-wrap" @focusout="closeMenuOnFocusOut" @keydown.esc="menuOpen = false">
                    <button
                        type="button"
                        class="translate-toggle"
                        :class="{ 'is-on': shownLanguage }"
                        :aria-expanded="shownLanguage ? undefined : menuOpen"
                        :aria-pressed="shownLanguage ? true : undefined"
                        :disabled="Boolean(translatingTo)"
                        :aria-label="compact ? translateLabel : undefined"
                        :title="compact ? translateLabel : undefined"
                        data-testid="log-translate"
                        @click="onTranslateButton"
                    >
                        <span v-if="translatingTo" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                        <i v-else class="bi bi-translate" aria-hidden="true"></i>
                        <span v-if="!compact" class="toggle-text">
                            <template v-if="translatingTo">Translating...</template>
                            <template v-else-if="shownLanguage">
                                <span class="toggle-verb">Showing</span> {{ languageLabel(shownLanguage) }}
                            </template>
                            <template v-else>Translate</template>
                        </span>
                    </button>

                    <ul v-if="menuOpen" class="language-menu" role="menu" aria-label="Translate to">
                        <li v-for="option in languageOptions" :key="option.code" role="none">
                            <button
                                type="button"
                                role="menuitem"
                                :data-testid="`log-translate-${option.code}`"
                                @click="chooseLanguage(option.code)"
                            >
                                <span :lang="option.code">{{ option.label }}</span>
                                <!-- <i v-if="option.cached" class="bi bi-check2" aria-label="saved"></i> -->
                            </button>
                        </li>
                    </ul>
                </div>

                <template v-if="canChange">
                    <button type="button" class="icon-button" aria-label="Edit note" @click="emit('edit', log)">
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="icon-button is-danger" aria-label="Delete note" @click="emit('delete', log)">
                        <i class="bi bi-trash3" aria-hidden="true"></i>
                    </button>
                </template>
            </div>
        </header>

        <p class="log-content">{{ log.content }}</p>

        <dl v-if="consultation" class="consultation">
            <div v-if="consultation.doctorName">
                <dt>Doctor</dt>
                <dd>{{ consultation.doctorName }}</dd>
            </div>
            <div v-if="consultation.nextAppointment">
                <dt>Next appointment</dt>
                <dd>{{ formatDate(consultation.nextAppointment, true) }}</dd>
            </div>
        </dl>

        <ul v-if="log.medicationChanges?.length" class="medication-changes">
            <li v-for="(change, index) in log.medicationChanges" :key="index">
                <i class="bi bi-capsule" aria-hidden="true"></i>
                <strong>{{ change.name }}</strong>
                <span class="change-kind">{{ MEDICATION_CHANGE_LABELS[change.change] || change.change }}</span>
                <span v-if="change.details" class="change-details">{{ change.details }}</span>
            </li>
        </ul>

        <p v-if="translateError" class="translate-error" role="alert">{{ translateError }}</p>

        <div v-if="shownLanguage" class="translation" :lang="shownLanguage">
            <span class="translation-label">{{ languageLabel(shownLanguage) }} · AzureTranslate</span>
            <p>{{ translations[shownLanguage] }}</p>
        </div>
    </article>
</template>

<style scoped>
.log-card {
    padding: 16px 18px;
    background: var(--theme-panel, white);
    border: 1px solid var(--theme-border, #E4ECE5);
    border-radius: 14px;
}

.log-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.author-avatar {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--theme-warning-soft, #FDF3E4);
    color: var(--theme-danger, #A0703A);
    font-size: 12px;
    font-weight: 800;
}

.log-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 10px;
}

.author-name {
    font-size: 15px;
    font-weight: 800;
    color: var(--theme-text, #2F2F2F);
}

.type-badge {
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    background: var(--theme-neutral, #EEF0F2);
    color: var(--theme-muted, #5F6670);
}

.type-consultation { background: var(--theme-purple-soft, #EEE8FA); color: var(--theme-purple, #6A4FA3); }
.type-medication_change { background: var(--theme-warning-soft, #FFF3D6); color: var(--theme-warning, #93650A); }
.type-diet { background: var(--theme-soft, #EAF4EC); color: var(--theme-green, #3B7A4F); }
.type-symptom { background: var(--theme-pink-soft, #FBE9F2); color: var(--theme-pink, #A3456F); }

.log-when {
    font-size: 13px;
    color: var(--theme-muted, #7B8391);
}

.log-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.translate-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-green, #3B7A4F);
    font-size: 13px;
    font-weight: 700;
}

.translate-toggle:hover:not(:disabled),
.translate-toggle.is-on {
    background: var(--theme-soft, #EAF4EC);
}

.translate-wrap {
    position: relative;
}

.language-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 5;
    min-width: 170px;
    margin: 0;
    padding: 6px;
    list-style: none;
    background: var(--theme-panel, white);
    border: 1px solid var(--theme-border, #E4ECE5);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(47, 47, 47, 0.12);
}

.language-menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text, #2F2F2F);
    font-size: 14px;
    text-align: left;
}

.language-menu button:hover,
.language-menu button:focus-visible {
    background: var(--theme-soft, #EAF4EC);
}

.language-menu .bi-check2 {
    color: var(--theme-green, #3B7A4F);
}

.translate-error {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--theme-danger, #C0564B);
}

.icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-muted, #7B8391);
}

.icon-button:hover {
    background: var(--theme-page, #F1F4F2);
    color: var(--theme-text, #2F2F2F);
}

.icon-button.is-danger:hover {
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
}

.log-content {
    margin: 0;
    font-size: 15px;
    line-height: 1.55;
    color: var(--theme-text, #2F2F2F);
    white-space: pre-line;
}

.consultation {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 24px;
    margin: 10px 0 0;
    font-size: 13px;
}

.consultation dt {
    font-weight: 700;
    color: var(--theme-muted, #7B8391);
}

.consultation dd {
    margin: 0;
    color: var(--theme-text, #2F2F2F);
}

.medication-changes {
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.medication-changes li {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--theme-warning-soft, #FFF8E6);
    color: var(--theme-warning, #6B5413);
    font-size: 14px;
}

.change-kind {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--theme-warning-soft, #FFEDBF);
    font-size: 12px;
    font-weight: 700;
}

.change-details {
    color: var(--theme-warning, #7B6A3A);
}

.translation {
    margin-top: 12px;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--theme-page, #F5F7F5);
}

.translation-label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--theme-muted, #7B8391);
}

.translation p {
    margin: 0;
    font-size: 15px;
    color: var(--theme-text, #2F2F2F);
}

/* Compact: name and badge on the first line, date under them, buttons top right */
.log-card.is-compact .log-head {
    align-items: flex-start;
    gap: 8px;
}

.log-card.is-compact .log-actions {
    gap: 0;
    margin: -4px -6px 0 0;
}

.log-card.is-compact .translate-toggle {
    padding: 6px;
    font-size: 15px;
}

.log-card.is-compact .log-when {
    flex-basis: 100%;
}

@media (max-width: 575px) {
    .log-head {
        align-items: flex-start;
    }

    .log-actions {
        flex-wrap: wrap;
        justify-content: flex-end;
    }

    .toggle-verb {
        display: none;
    }
}
</style>
