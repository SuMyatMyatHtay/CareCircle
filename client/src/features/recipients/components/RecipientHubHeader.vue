<script setup>
import CareAvatar from '../../../components/common/CareAvatar.vue'
// Owner: Jhen (C)
// Top of the recipient hub: initials, name and age, key care chips, Edit / New task, and the four tabs.
//   <RecipientHubHeader :recipient="recipient" @updated="replace" />
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import NewTaskButton from '../../tasks/components/NewTaskButton.vue'
import RecipientFormModal from './RecipientFormModal.vue'
import { displayName, initials, ageLabel, careTypeChip, mobilityChip } from '../recipientLabels.js'

const props = defineProps({
    recipient: { type: Object, required: true }
})

const emit = defineEmits(['updated'])

const route = useRoute()

const TABS = [
    { name: 'recipient-overview', label: 'Overview' },
    { name: 'recipient-tasks', label: 'Tasks' },
    { name: 'recipient-log', label: 'Log' },
    { name: 'recipient-profile', label: 'Profile' }
]

const shownName = computed(() => displayName(props.recipient))

// "Tan Ah Kow · 82": the full name only when it differs from what's shown
const subtitle = computed(() => {
    const parts = []
    if (props.recipient.nickname && props.recipient.name !== props.recipient.nickname) parts.push(props.recipient.name)
    const age = ageLabel(props.recipient.dateOfBirth)
    if (age) parts.push(age)
    return parts.join(' · ')
})

const mobility = computed(() => mobilityChip(props.recipient.mobility?.level))

const editing = ref(false)
</script>

<template>
    <header class="hub-header">
        <div class="hub-identity">
            <CareAvatar :person="recipient" size="profile" />

            <div class="hub-name">
                <div class="hub-title-row">
                    <h1>{{ shownName }}</h1>
                    <span v-if="subtitle" class="hub-subtitle">{{ subtitle }}</span>
                </div>

                <div class="hub-chips">
                    <span class="chip chip-care">{{ careTypeChip(recipient.careType) }}</span>
                    <span v-if="mobility" class="chip chip-muted">{{ mobility }}</span>
                    <span v-for="allergy in recipient.allergies" :key="allergy.name" class="chip"
                        :class="allergy.severity === 'severe' ? 'chip-coral' : 'chip-muted'">
                        {{ allergy.name }} allergy
                    </span>
                </div>
            </div>

            <div class="hub-actions">
                <button type="button" class="edit-button" @click="editing = true">Edit profile</button>
                <NewTaskButton :recipient="recipient" />
            </div>
        </div>

        <nav class="hub-tabs" aria-label="Recipient sections">
            <RouterLink v-for="tab in TABS" :key="tab.name" class="hub-tab"
                :class="{ active: route.name === tab.name }"
                :aria-current="route.name === tab.name ? 'page' : null"
                :to="{ name: tab.name, params: { recipientId: recipient._id } }">
                {{ tab.label }}
            </RouterLink>
        </nav>

        <RecipientFormModal v-if="editing" :recipient="recipient" @updated="emit('updated', $event)"
            @close="editing = false" />
    </header>
</template>

<style scoped>
.hub-header {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 24px;
}

.hub-identity {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
}

.hub-avatar {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--theme-warning-soft, #FDF3E4);
    color: var(--theme-danger, #A0703A);
    font-size: 28px;
    font-weight: 800;
}

.hub-name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.hub-title-row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 12px;
}

.hub-title-row h1 {
    margin: 0;
    font-size: 30px;
    font-weight: 800;
    color: var(--theme-text, #2F2F2F);
    overflow-wrap: anywhere;
}

.hub-subtitle {
    font-size: 16px;
    color: var(--theme-muted, #7B8391);
}

.hub-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.chip {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
}

.chip-care {
    background: var(--theme-purple-soft, #EEE8FD);
    color: var(--theme-purple, #4B3B8F);
}

.chip-muted {
    background: var(--theme-page, #F3F4F1);
    color: var(--theme-text, #2F2F2F);
}

.chip-coral {
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
}

.hub-actions {
    display: flex;
    gap: 12px;
}

.edit-button {
    padding: 11px 16px;
    border: 1px solid var(--theme-border, #E4ECE5);
    border-radius: 10px;
    background: var(--theme-panel, white);
    color: var(--theme-text, #2F2F2F);
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
}

.edit-button:hover {
    background: var(--theme-page, #F7FAF7);
}

.hub-tabs {
    display: flex;
    gap: 28px;
    border-bottom: 1px solid var(--theme-border, #E4ECE5);
    overflow-x: auto;
    scrollbar-width: none;
}

.hub-tab {
    flex: 0 0 auto;
    padding: 6px 0 12px;
    border-bottom: 2px solid transparent;
    color: var(--theme-muted, #7B8391);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
}

.hub-tab:hover {
    color: var(--theme-text, #2F2F2F);
}

.hub-tab.active {
    border-bottom-color: var(--theme-accent-border, #2E7D43);
    color: var(--theme-green, #2E7D43);
    font-weight: 700;
}

@media (max-width: 767px) {
    .hub-identity {
        gap: 14px;
    }

    .hub-avatar {
        width: 64px;
        height: 64px;
        font-size: 22px;
    }

    .hub-title-row h1 {
        font-size: 24px;
    }

    .hub-actions {
        width: 100%;
    }

    .hub-tabs {
        gap: 22px;
    }
}
</style>
