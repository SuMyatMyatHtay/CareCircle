<script setup>
// Owner: SeungHak (F)
// A care note's text in the reader's preferred language, for short previews outside the
// Log tab (e.g. "Latest notes" on the recipient Overview). Same rules as LogCard: the
// translation is cached on the server, and a note already in that language shows as written.
//   <NoteText :family-id="familyId" :log="log" />
import { computed, onMounted, ref, watch } from 'vue'
import { translateLog } from '../services/logsApi.js'
import { languageLabel } from '../logTypes.js'
import { preferredLanguage } from '../preferredLanguage.js'

const props = defineProps({
    familyId: { type: String, required: true },
    log: { type: Object, required: true }
})

const lang = preferredLanguage()
const translation = ref('')
const showOriginal = ref(false)
let version = 0

const isTranslated = computed(() => Boolean(translation.value) && translation.value.trim() !== props.log.content.trim())
const text = computed(() => (isTranslated.value && !showOriginal.value ? translation.value : props.log.content))

async function load() {
    const current = ++version
    translation.value = ''
    showOriginal.value = false
    if (!lang || !props.familyId) return
    const cached = props.log.translations?.[lang]
    if (cached) {
        translation.value = cached
        return
    }
    try {
        const result = await translateLog(props.familyId, props.log._id, lang)
        if (current === version) translation.value = result
    } catch {
        // No translation: the original stays
    }
}
onMounted(load)
watch(() => [props.log._id, props.log.content], load)
</script>

<template>
    <div class="note-text">
        <p class="note-text-body" :lang="isTranslated && !showOriginal ? lang : undefined">{{ text }}</p>
        <button v-if="isTranslated" type="button" class="note-text-toggle" @click="showOriginal = !showOriginal">
            <i class="bi bi-translate" aria-hidden="true"></i>
            {{ showOriginal ? `Show ${languageLabel(lang)}` : `${languageLabel(lang)} · Show original` }}
        </button>
    </div>
</template>

<style scoped>
.note-text-body {
    margin: 0;
    white-space: pre-line;
}

.note-text-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    padding: 0;
    border: none;
    background: none;
    color: var(--theme-green, #2d7d43);
    font-size: 12px;
    font-weight: 700;
}
</style>
