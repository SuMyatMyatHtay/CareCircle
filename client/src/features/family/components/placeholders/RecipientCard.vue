<script setup>
// PLACEHOLDER (owner: C, Jhen). One care recipient card, static data for now.
import BlankLine from './BlankLine.vue'

defineProps({
    recipient: { type: Object, required: true }
})

const emit = defineEmits(['open-hub'])
</script>

<template>
    <article class="recipient-card">
        <div class="recipient-head">
            <span class="avatar" aria-hidden="true">{{ recipient.avatar }}</span>
            <div class="head-text">
                <h3 v-if="recipient.name">{{ recipient.name }}</h3>
                <BlankLine v-else width="55%" height="16px" />
                <p v-if="recipient.summary">{{ recipient.summary }}</p>
                <BlankLine v-else width="80%" />
            </div>
        </div>

        <p v-if="recipient.next" class="next">Next: {{ recipient.next }}</p>
        <BlankLine v-else class="next" width="70%" />

        <div class="recipient-foot">
            <span v-if="recipient.needsSomeone" class="needs-pill">
                {{ recipient.needsSomeone }} needs someone
            </span>
            <button type="button" class="open-hub" @click="emit('open-hub', recipient.id)">
                Open hub <i class="bi bi-arrow-right" aria-hidden="true"></i>
            </button>
        </div>
    </article>
</template>

<style scoped>
.recipient-card {
    height: 100%;
    padding: 20px;
    background: white;
    border: 1px solid #E4ECE5;
    border-radius: 16px;
}

.recipient-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #E8F5E9;
    font-size: 28px;
}

h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
}

.head-text {
    flex: 1;
}

.recipient-head p {
    margin: 0;
    font-size: 14px;
    color: #7B8391;
}

.next {
    margin-bottom: 14px;
    font-size: 14px;
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
    background: #FFF0EB;
    color: #C0564B;
    font-size: 12px;
    font-weight: 700;
}

.open-hub {
    margin-left: auto;
    padding: 0;
    border: none;
    background: none;
    color: #2E7D43;
    font-size: 14px;
    font-weight: 700;
}
</style>
