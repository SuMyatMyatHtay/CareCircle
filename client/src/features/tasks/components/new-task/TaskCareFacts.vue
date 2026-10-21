<script setup>
// Owner: Marcus (D)
// "Helper should know" chips from a recipient's profile: severe allergies (coral),
// mobility (lavender), care notes (amber). Same colour roles as the Profile tab.
// Renders nothing when there's nothing to say.
//   <TaskCareFacts :recipient="recipient" />
import { computed } from 'vue'
import { careFacts } from './careFacts.js'

const props = defineProps({
    recipient: { type: Object, default: null }
})

const facts = computed(() => careFacts(props.recipient))
</script>

<template>
    <ul v-if="facts.length" class="care-facts">
        <li v-for="(fact, index) in facts" :key="index" class="fact-chip" :class="`fact-${fact.tone}`">
            <i v-if="fact.icon" class="bi" :class="fact.icon" aria-hidden="true"></i>
            {{ fact.text }}
        </li>
    </ul>
</template>

<style scoped>
.care-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.fact-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
}

.fact-coral {
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #9A3A2A);
    font-weight: 600;
}

.fact-lavender {
    background: var(--theme-purple-soft, #EEE8FD);
    color: var(--theme-purple, #4B3B8F);
}

.fact-amber {
    background: var(--theme-warning-soft, #FFF8E1);
    color: var(--theme-warning, #7A5A00);
}
</style>
