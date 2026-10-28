<script setup>
// Owner: Marcus (D)
// New task as a full page, for phones (below md). /tasks/new, optionally ?recipient=<id>.
// Same form as NewTaskModal (useTaskForm), laid out as numbered cards with a live preview.
import '../components/new-task/newTask.css'
import { ref, computed, watch, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { useRecipients } from '../../../composables/useRecipients.js'
import { useTaskForm, dateLabel, timeLabel, TASK_CATEGORIES } from '../composables/useTaskForm.js'
import { displayName } from '../../recipients/recipientLabels.js'
import TaskPersonPicker from '../components/new-task/TaskPersonPicker.vue'
import TaskCategoryPicker from '../components/new-task/TaskCategoryPicker.vue'
import TaskWhenFields from '../components/new-task/TaskWhenFields.vue'
import TaskRepeatFields from '../components/new-task/TaskRepeatFields.vue'
import TaskPlacePicker from '../components/new-task/TaskPlacePicker.vue'
import TaskTransitToggle from '../components/new-task/TaskTransitToggle.vue'
import TaskCareFacts from '../components/new-task/TaskCareFacts.vue'
import { careFacts } from '../components/new-task/careFacts.js'

const id = useId()
const route = useRoute()
const router = useRouter()
const { selectedFamilyId, selectedFamily } = useActiveFamily()
const { recipients } = useRecipients()

const form = useTaskForm({ recipientId: route.query.recipient || null })

const familyLabel = computed(() => {
    const name = selectedFamily.value?.name || 'your'
    return /family$/i.test(name) ? name : `${name} family`
})

const selectedRecipient = computed(() => recipients.value.find((r) => r._id === form.recipient.value) || null)
const recipientName = computed(() => displayName(selectedRecipient.value))

// ---- Preview ----
const startDate = computed(() => form.startAt.value)
const previewWeekday = computed(() => dateLabel(form.scheduledDate.value).split(' ')[0].toUpperCase())
const previewDay = computed(() => Number(form.scheduledDate.value.split('-')[2]))
const previewTime = computed(() => {
    if (!startDate.value) return ''
    return form.endAt.value ? `${timeLabel(startDate.value)}–${timeLabel(form.endAt.value)}` : timeLabel(startDate.value)
})
const previewMeta = computed(() =>
    [recipientName.value || 'Household', previewTime.value, form.location.value?.name].filter(Boolean).join(' · ')
)
const categoryLabel = computed(() => TASK_CATEGORIES.find((c) => c.value === form.category.value)?.label)

// The message the family's Telegram group gets (no health details, see the design doc)
const telegramText = computed(() => {
    const what = form.title.value.trim() || 'a task'
    const forWhom = recipientName.value ? `${recipientName.value}'s ${what.charAt(0).toLowerCase()}${what.slice(1)}` : what
    const when = [dateLabel(form.scheduledDate.value), startDate.value ? timeLabel(startDate.value) : ''].filter(Boolean).join(' ')
    const transit = form.needsTransit.value ? ' Needs someone to take them there.' : ''
    return `New task: ${forWhom}, ${when}.${transit} Who can take it?`
})

const hasFacts = computed(() => careFacts(selectedRecipient.value).length > 0)

// One line for the sticky footer
const summary = computed(() => {
    if (!form.canSubmit.value) return form.missingMessage.value
    return [form.title.value.trim(), recipientName.value || 'Household', `${dateLabel(form.scheduledDate.value)} ${previewTime.value}`]
        .join(' · ')
})

const preview = ref(null)
function showPreview() {
    preview.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---- Leaving ----
function goBack() {
    if (window.history.state?.back) router.back()
    else if (route.query.recipient) router.push({ name: 'recipient-overview', params: { recipientId: route.query.recipient } })
    else router.push('/home')
}

async function post() {
    const task = await form.submit(selectedFamilyId.value)
    if (task) goBack()
}

// A task belongs to one family; switching family leaves the form
watch(selectedFamilyId, (newId, oldId) => {
    if (oldId && newId !== oldId) router.push('/home')
})
</script>

<template>
    <form class="new-task-page" novalidate @submit.prevent="post">
        <header class="page-header">
            <button type="button" class="back-button" aria-label="Back" @click="goBack">
                <i class="bi bi-arrow-left" aria-hidden="true"></i>
            </button>
            <div>
                <h1>{{ recipientName ? `New task for ${recipientName}` : 'New task' }}</h1>
                <p>Posted to the {{ familyLabel }}. Anyone can claim it.</p>
            </div>
        </header>

        <p v-if="!selectedFamily" class="task-submit-error">Choose a family in the sidebar first.</p>

        <template v-else>
            <section class="step-card" aria-labelledby="step-1">
                <h2 id="step-1"><span class="step-number">1</span> Who and what</h2>
                <TaskPersonPicker v-model="form.recipient.value" :recipients="recipients"
                    :error="form.fieldError('recipient')" />

                <div class="task-field">
                    <label class="task-label" :for="`${id}-what`">What needs doing?</label>
                    <input :id="`${id}-what`" v-model="form.title.value" class="task-input"
                        :class="{ 'is-invalid': form.fieldError('title') }" maxlength="120"
                        placeholder="e.g. Physio session, collect medicine">
                    <p v-if="form.fieldError('title')" class="task-field-error">{{ form.fieldError('title') }}</p>
                </div>

                <TaskCategoryPicker v-model="form.category.value" :error="form.fieldError('category')" />
            </section>

            <section class="step-card" aria-labelledby="step-2">
                <h2 id="step-2"><span class="step-number">2</span> When and where</h2>
                <TaskWhenFields v-model:date="form.date.value" v-model:start-time="form.startTime.value"
                    :weekly="form.isWeekly.value" :first-date="form.scheduledDate.value"
                    v-model:end-time="form.endTime.value" :start-error="form.fieldError('startAt')"
                    :end-error="form.fieldError('endAt') || form.errors.value.endAt" />

                <TaskRepeatFields v-model="form.recurrence.value" :date="form.scheduledDate.value" :preview="form.repeatPreview.value" />
                <TaskPlacePicker v-model="form.location.value" :suggestion="selectedRecipient?.preferredClinic"
                    :suggestion-label="selectedRecipient ? `${recipientName}'s preferred clinic` : ''"
                    :error="form.fieldError('location') || form.errors.value.location" />
            </section>

            <TaskTransitToggle v-model="form.needsTransit.value" :disabled="!form.location.value" />

            <section class="step-card" aria-labelledby="step-3">
                <h2 id="step-3"><span class="step-number">3</span> Notes</h2>
                <div class="task-field">
                    <label class="task-label" :for="`${id}-notes`">
                        Notes for the helper <span class="task-optional">(optional)</span>
                    </label>
                    <textarea :id="`${id}-notes`" v-model="form.description.value" class="task-input" maxlength="2000"
                        placeholder="Anything the helper should bring or know"></textarea>
                    <p v-if="form.fieldError('description') || form.errors.value.description" class="task-field-error">
                        {{ form.fieldError('description') || form.errors.value.description }}
                    </p>
                </div>
            </section>

            <section ref="preview" class="preview" aria-labelledby="preview-title">
                <h2 id="preview-title" class="preview-title">Preview · how the family sees it</h2>

                <article class="preview-row">
                    <div class="date-badge">
                        <span class="date-weekday">{{ previewWeekday }}</span>
                        <span class="date-day">{{ previewDay }}</span>
                    </div>
                    <div class="preview-text">
                        <h3 :class="{ placeholder: !form.title.value.trim() }">
                            {{ form.title.value.trim() || 'What needs doing?' }}
                        </h3>
                        <p>{{ previewMeta }}</p>
                        <div class="preview-badges">
                            <span v-if="form.needsTransit.value" class="badge-transit">Needs transit</span>
                            <span class="badge-open">Open</span>
                            <span v-if="categoryLabel" class="badge-category">{{ categoryLabel }}</span>
                        </div>
                    </div>
                </article>

                <div class="telegram-preview">
                    <span class="preview-label"><i class="bi bi-send" aria-hidden="true"></i> Telegram message</span>
                    <p>{{ telegramText }}</p>
                </div>

                <div v-if="hasFacts" class="facts-preview">
                    <span class="preview-label">Shown to whoever claims it</span>
                    <TaskCareFacts :recipient="selectedRecipient" />
                </div>
            </section>

            <p v-if="form.submitError.value" class="task-submit-error" role="alert">
                <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
                {{ form.submitError.value }}
            </p>

            <footer class="sticky-footer">
                <button type="button" class="summary" :class="{ 'is-missing': !form.canSubmit.value }" @click="showPreview">
                    {{ summary }}
                </button>
                <button type="submit" class="post-button" :disabled="!form.canSubmit.value || form.isSubmitting.value">
                    <span v-if="form.isSubmitting.value" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                    {{ form.isSubmitting.value ? 'Posting...' : form.postLabel.value }}
                </button>
            </footer>
        </template>
    </form>
</template>

<style scoped>
.new-task-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 640px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.page-header h1 {
    margin: 6px 0 2px;
    font-size: 22px;
    font-weight: 800;
    color: var(--theme-text, #2F2F2F);
}

.page-header p {
    margin: 0;
    font-size: 13px;
    color: var(--theme-muted, #6B7280);
}

.back-button {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 10px;
    background: none;
    color: var(--theme-text, #2F2F2F);
    font-size: 20px;
}

.step-card {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px 16px;
    border: 1px solid var(--theme-border, #E4ECE5);
    border-radius: 16px;
    background: var(--theme-panel, white);
}

.step-card h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--theme-text, #2F2F2F);
}

.step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--theme-soft, #E8F5E9);
    color: var(--theme-green, #2F7A3F);
    font-size: 13px;
    font-weight: 800;
}

.preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-margin-top: 16px;
}

.preview-title {
    margin: 8px 0 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-muted, #6B7280);
}

.preview-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid var(--theme-danger-border, #FFDAD0);
    border-radius: 14px;
    background: var(--theme-panel, white);
}

.date-badge {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
    border-radius: 10px;
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
    line-height: 1.1;
}

.date-weekday {
    font-size: 11px;
    font-weight: 800;
}

.date-day {
    font-size: 19px;
    font-weight: 800;
}

.preview-text {
    flex: 1;
    min-width: 0;
}

.preview-text h3 {
    margin: 0 0 3px;
    font-size: 16px;
    font-weight: 700;
    color: var(--theme-text, #2F2F2F);
    overflow-wrap: anywhere;
}

.preview-text h3.placeholder {
    color: var(--theme-muted, #9CA3AF);
}

.preview-text p {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--theme-muted, #7B8391);
}

.preview-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.preview-badges span {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
}

.badge-open {
    background: var(--theme-danger-soft, #FFF0EB);
    color: var(--theme-danger, #C0564B);
}

.badge-transit {
    background: var(--theme-purple-soft, #EEE8FD);
    color: var(--theme-purple, #4B3B8F);
}

.badge-category {
    background: var(--theme-page, #F3F4F1);
    color: var(--theme-muted, #5D6B7A);
}

.telegram-preview,
.facts-preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border-radius: 14px;
    background: var(--theme-page, #FBFBF7);
    border: 1px solid var(--theme-border, #EEF0EC);
}

.telegram-preview p {
    margin: 0;
    font-size: 14px;
    color: var(--theme-text, #2F2F2F);
}

.preview-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-muted, #6B7280);
}

.sticky-footer {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 -18px -25px;
    padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--theme-border, #EEF0EC);
    background: var(--theme-page, #FBFBF7);
}

.summary {
    min-height: 44px;
    padding: 0;
    overflow: hidden;
    border: none;
    background: none;
    color: var(--theme-text, #2F2F2F);
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.summary.is-missing {
    color: var(--theme-danger, #9A3A2A);
    font-weight: 500;
}

.post-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    border: none;
    border-radius: 10px;
    background: #2F7A3F;
    color: white;
    font-size: 15px;
    font-weight: 700;
}

.post-button:disabled {
    opacity: 0.45;
}

@media (min-width: 768px) {
    .sticky-footer {
        margin: 0;
        border: 1px solid var(--theme-border, #EEF0EC);
        border-radius: 14px;
    }
}
</style>
