<script setup>
import CareAvatar from '../../../../components/common/CareAvatar.vue'
// Owner: Marcus (D)
// "Who is it for?": one pill per care recipient plus a dashed "Household" pill (null).
//   <TaskPersonPicker v-model="form.recipient.value" :recipients="recipients" />
import { displayName, initials } from '../../../recipients/recipientLabels.js'

defineProps({
    recipients: { type: Array, default: () => [] },
    error: { type: String, default: '' }
})

const model = defineModel({ type: [String, null], default: null })
</script>

<template>
    <fieldset class="task-field">
        <legend class="task-label">Who is it for?</legend>
        <div class="person-pills">
            <button v-for="recipient in recipients" :key="recipient._id" type="button" class="person-pill"
                :class="{ selected: model === recipient._id }" :aria-pressed="model === recipient._id"
                @click="model = recipient._id">
                <CareAvatar :person="recipient" size="tiny" />
                {{ displayName(recipient) }}
            </button>
            <button type="button" class="person-pill household" :class="{ selected: model === null }"
                :aria-pressed="model === null" @click="model = null">
                <i class="bi bi-house-heart" aria-hidden="true"></i>
                Household
            </button>
        </div>
        <p v-if="error" class="task-field-error" role="alert">{{ error }}</p>
    </fieldset>
</template>

<style scoped>
.person-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.person-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 6px 14px 6px 6px;
    border: 1px solid var(--theme-border, #E5E7EB);
    border-radius: 999px;
    background: var(--theme-panel, white);
    color: var(--theme-text, #2F2F2F);
    font-size: 14px;
    font-weight: 500;
}

.person-pill:hover {
    background: var(--theme-page, #F7FAF7);
}

.person-pill.household {
    padding-left: 14px;
    border-style: dashed;
    border-color: var(--theme-border, #C9CEC6);
}

.person-pill.selected {
    padding: 5px 13px 5px 5px;
    border: 2px solid var(--theme-accent-border, #2F7A3F);
    background: var(--theme-soft, #E8F5E9);
    color: var(--theme-green, #1F5A2C);
    font-weight: 600;
}

.person-pill.household.selected {
    padding-left: 13px;
    border-style: solid;
}

.person-pill:focus-visible {
    outline: 3px solid var(--theme-accent-border, #A8D5B5);
    outline-offset: 2px;
}

.pill-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--theme-warning-soft, #FDF3E4);
    color: var(--theme-danger, #A0703A);
    font-size: 11px;
    font-weight: 800;
}
</style>
