<script setup>
// Owner: Marcus (D)
// Text with the search word wrapped in <mark>. The text is split into pieces and rendered
// as text nodes, never as HTML, so a note containing "<b>" shows exactly that.
//   <HighlightText text="Eye check-up" query="eye" />
import { computed } from 'vue'
import { highlightParts } from '../searchFormat.js'

const props = defineProps({
    text: { type: [String, Number], default: '' },
    query: { type: String, default: '' }
})

const parts = computed(() => highlightParts(props.text, props.query))
</script>

<template>
    <template v-for="(part, index) in parts" :key="index">
        <mark v-if="part.match" class="search-mark">{{ part.text }}</mark>
        <template v-else>{{ part.text }}</template>
    </template>
</template>
