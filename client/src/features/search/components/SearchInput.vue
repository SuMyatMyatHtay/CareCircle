<script setup>
// Owner: Marcus (D)
// The search box itself (Figma cc/Search bar): icon, input, then the "Ctrl K" hint
// or a clear button once there is text. Extra attributes (role, aria-*) go on the <input>.
//   <SearchInput v-model="q" shortcut @keydown="onKeydown" />
import { ref } from 'vue'

defineOptions({ inheritAttrs: false })

const model = defineModel({ type: String, default: '' })

defineProps({
    // Show the "Ctrl K" hint while empty (desktop bar only)
    shortcut: { type: Boolean, default: false },
    // 'bar' (desktop) or 'mobile' (taller text, 44px clear button)
    variant: { type: String, default: 'bar' },
    label: { type: String, default: 'Search the family' }
})

const emit = defineEmits(['clear'])

const input = ref(null)

function focus() {
    input.value?.focus()
}

function clear() {
    model.value = ''
    emit('clear')
    focus()
}

defineExpose({ focus, input })
</script>

<template>
    <div class="search-input" :class="`search-input--${variant}`">
        <i class="bi bi-search search-input-icon" aria-hidden="true"></i>
        <input
            ref="input"
            v-model="model"
            v-bind="$attrs"
            type="search"
            class="search-input-field"
            :aria-label="label"
            placeholder="Search tasks, notes, people and places"
            autocomplete="off"
            spellcheck="false"
            enterkeyhint="search"
            maxlength="80"
        >
        <button v-if="model" type="button" class="search-input-clear" aria-label="Clear search" @click="clear">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
        <kbd v-else-if="shortcut" class="search-input-shortcut" aria-hidden="true">Ctrl K</kbd>
    </div>
</template>
