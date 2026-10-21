<script setup>
// Owner: Jhen (C)
// /recipients/new: the add form on its own page. Opens the new recipient's hub after saving.
import { useRouter } from 'vue-router'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { useRecipients } from '../../../composables/useRecipients.js'
import SectionCard from '../../../components/common/SectionCard.vue'
import RecipientForm from '../components/RecipientForm.vue'

const router = useRouter()
const { selectedFamily } = useActiveFamily()
const { refresh } = useRecipients()

function onSaved(recipient) {
    refresh()
    router.push({ name: 'recipient-overview', params: { recipientId: recipient._id } })
}
</script>

<template>
    <div class="new-recipient-page">
        <nav class="breadcrumb-row" aria-label="Breadcrumb">
            <RouterLink to="/home">Family home</RouterLink>
            <span aria-hidden="true">/</span>
            <span class="current" aria-current="page">Add care recipient</span>
        </nav>

        <p v-if="!selectedFamily" class="no-family">Choose a family in the sidebar first.</p>

        <SectionCard v-else title="Add care recipient">
            <p class="intro">Who is {{ selectedFamily.name }} caring for? You can change any of this later.</p>
            <RecipientForm @saved="onSaved" @cancel="router.push('/home')" />
        </SectionCard>
    </div>
</template>

<style scoped>
.new-recipient-page {
    max-width: 760px;
    padding-top: 24px;
}

.breadcrumb-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 20px;
    font-size: 14px;
    color: var(--theme-muted, #7B8391);
}

.breadcrumb-row a {
    color: var(--theme-muted, #7B8391);
    text-decoration: none;
}

.breadcrumb-row .current {
    color: var(--theme-text, #2F2F2F);
    font-weight: 700;
}

.intro {
    margin: -6px 0 18px;
    font-size: 14px;
    color: var(--theme-muted, #7B8391);
}

.no-family {
    padding: 28px;
    background: var(--theme-panel, white);
    border: 1px dashed var(--theme-border, #D5E2D8);
    border-radius: 14px;
    color: var(--theme-muted, #7B8391);
}
</style>
