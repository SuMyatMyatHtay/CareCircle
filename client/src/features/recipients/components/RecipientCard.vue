<script setup>
// Owner: Jhen (C)
// One care recipient on Family home: initials, name, care summary and a link to their hub.
//   <RecipientCard :recipient="recipient" :needs-someone="2" />
import { computed } from 'vue'
import { displayName, initials, careTypeChip, mobilityChip } from '../recipientLabels.js'

const props = defineProps({
    recipient: { type: Object, required: true },
    // Open tasks for this recipient, from the home page's task list
    needsSomeone: { type: Number, default: 0 }
})

const name = computed(() => displayName(props.recipient))

const summary = computed(() =>
    [careTypeChip(props.recipient.careType), mobilityChip(props.recipient.mobility?.level)].filter(Boolean).join(' · ')
)
</script>

<template>
    <article class="recipient-card">
        <div class="recipient-head">
            <span class="avatar" aria-hidden="true">{{ initials(name) }}</span>
            <div class="head-text">
                <h3>{{ name }}</h3>
                <p>{{ summary }}</p>
            </div>
        </div>

        <div class="recipient-foot">
            <span v-if="needsSomeone" class="needs-pill">
                {{ needsSomeone }} {{ needsSomeone === 1 ? 'needs' : 'need' }} someone
            </span>
            <RouterLink class="open-hub" :to="{ name: 'recipient-overview', params: { recipientId: recipient._id } }">
                Open hub <i class="bi bi-arrow-right" aria-hidden="true"></i>
            </RouterLink>
        </div>
    </article>
</template>

<style scoped>
.recipient-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 16px;
    height: 100%;
    padding: 20px;
    background: var(--theme-panel, white);
    border: 1px solid var(--theme-border, #E4ECE5);
    border-radius: 16px;
}

.recipient-head {
    display: flex;
    align-items: center;
    gap: 12px;
}

.avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--theme-warning-soft, #FDF3E4);
    color: var(--theme-danger, #A0703A);
    font-size: 18px;
    font-weight: 800;
}

.head-text {
    flex: 1;
    min-width: 0;
}

h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    overflow-wrap: anywhere;
}

.recipient-head p {
    margin: 0;
    font-size: 14px;
    color: var(--theme-muted, #7B8391);
}

.recipient-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.needs-pill {
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
    font-size: 12px;
    font-weight: 700;
}

.open-hub {
    margin-left: auto;
    color: var(--theme-green, #2E7D43);
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
}

.open-hub:hover {
    text-decoration: underline;
}
</style>
