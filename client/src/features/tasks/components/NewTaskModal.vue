<script setup>
// Owner: Marcus (D)
// New task pop-up for md and up (Figma 09 / 09b). Phones get NewTaskView instead.
// Pass a recipient to open it pre-filled from their hub ("New task for Grandpa").
//   <NewTaskModal :recipient="recipient" @created="onCreated" @close="open = false" />
// Pass a date to start on that day (a day clicked in the Calendar):
//   <NewTaskModal date="2026-10-30" @created="onCreated" @close="open = false" />
// Pass a task to edit it instead ("Edit" on Task detail):
//   <NewTaskModal :task="task" :family-id="familyId" @saved="onSaved" @close="open = false" />
// The /preview page passes save so posting goes to its sample data instead of the API.
import './new-task/newTask.css'
import { ref, computed, onMounted, onUnmounted, useId } from 'vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { useTaskForm } from '../composables/useTaskForm.js'
import { useAnimatedClose } from '../../../composables/useAnimatedClose.js'
import { displayName, initials } from '../../recipients/recipientLabels.js'
import TaskPersonPicker from './new-task/TaskPersonPicker.vue'
import TaskCategoryPicker from './new-task/TaskCategoryPicker.vue'
import TaskWhenFields from './new-task/TaskWhenFields.vue'
import TaskPlacePicker from './new-task/TaskPlacePicker.vue'
import TaskTransitToggle from './new-task/TaskTransitToggle.vue'
import TaskCareFacts from './new-task/TaskCareFacts.vue'
import { careFacts } from './new-task/careFacts.js'

const props = defineProps({
    recipient: { type: Object, default: null },
    save: { type: Function, default: null },
    task: { type: Object, default: null },        // edit this task instead of posting a new one
    date: { type: String, default: '' },          // "YYYY-MM-DD" to start a new task on
    familyId: { type: String, default: '' }      // the task's family, when it isn't the selected one
})

const emit = defineEmits(['created', 'saved', 'close'])
const isEdit = computed(() => Boolean(props.task))

// Every way out (Escape, backdrop, close, Cancel, after posting) fades the dialog out first
const { closing, requestClose, onAnimationEnd } = useAnimatedClose(() => emit('close'))

const id = useId()
// The workspace gives the real family, or the sample one on /preview
const { selectedFamilyId, selectedFamily, recipients } = useFamilyWorkspace()
const form = useTaskForm({ recipientId: props.recipient?._id ?? null, save: props.save, task: props.task, date: props.date || null })

// "Tan family" stays as it is; "Tan" becomes "Tan family"
const familyLabel = computed(() => {
    const name = selectedFamily.value?.name || 'your'
    return /family$/i.test(name) ? name : `${name} family`
})

// Opened from a hub: the person is fixed until "Change person" is clicked
const changingPerson = ref(false)
const isPrefilled = computed(() => Boolean(props.recipient) && !isEdit.value && !changingPerson.value)

const selectedRecipient = computed(() =>
    recipients.value.find((r) => r._id === form.recipient.value) ||
    (props.recipient?._id === form.recipient.value ? props.recipient : null)
)
const recipientName = computed(() => displayName(selectedRecipient.value))
const showHelperStrip = computed(() => isPrefilled.value && careFacts(selectedRecipient.value).length > 0)

async function post() {
    const task = await form.submit(props.familyId || selectedFamilyId.value)
    if (task) {
        emit(isEdit.value ? 'saved' : 'created', task)
        requestClose()
    }
}

// ---- Overlay behaviour: Escape closes, the page behind doesn't scroll ----
const titleInput = ref(null)

function onKeydown(event) {
    if (event.key === 'Escape') requestClose()
}

onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    document.body.classList.add('modal-open')
    titleInput.value?.focus()
})

onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    document.body.classList.remove('modal-open')
})
</script>

<template>
    <Teleport to="body">
        <!-- Parents mount this with v-if: it animates in with appear and out with `closing`.
             Bootstrap's own .fade classes are left off so they don't fight these. -->
        <Transition name="care-backdrop" appear>
            <div class="modal-backdrop show" :class="{ 'care-backdrop-closing': closing }"></div>
        </Transition>
        <div class="modal show d-block" tabindex="-1" role="dialog" aria-modal="true"
            :aria-labelledby="`${id}-title`" @click.self="requestClose">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable new-task-dialog">
                <Transition name="care-pop" appear>
                <form class="modal-content new-task-content" :class="{ 'care-pop-closing': closing }" novalidate
                    @submit.prevent="post" @animationend="onAnimationEnd">
                    <header class="new-task-header">
                        <span v-if="isPrefilled" class="header-avatar" aria-hidden="true">
                            {{ initials(recipientName) }}
                        </span>
                        <span v-else class="header-icon" aria-hidden="true">
                            <i class="bi" :class="isEdit ? 'bi-pencil' : 'bi-plus-lg'"></i>
                        </span>

                        <div class="header-text">
                            <h2 :id="`${id}-title`">
                                {{ isEdit ? 'Edit task' : isPrefilled ? `New task for ${recipientName}` : 'New task' }}
                            </h2>
                            <p>
                                <template v-if="isPrefilled">
                                    Posted to the {{ familyLabel }}.
                                    <button type="button" class="change-person" @click="changingPerson = true">
                                        Change person
                                    </button>
                                </template>
                                <template v-else-if="isEdit">Changes are shared with the {{ familyLabel }}.</template>
                                <template v-else>Posted to the {{ familyLabel }}. Anyone can claim it.</template>
                            </p>
                        </div>

                        <button type="button" class="close-button" aria-label="Close" @click="requestClose">
                            <i class="bi bi-x-lg" aria-hidden="true"></i>
                        </button>
                    </header>

                    <div v-if="showHelperStrip" class="helper-strip">
                        <span class="helper-label">Helper should know</span>
                        <TaskCareFacts :recipient="selectedRecipient" />
                    </div>

                    <div class="modal-body new-task-body">
                        <div class="row g-4">
                            <div class="col-md-6 d-flex flex-column gap-4">
                                <TaskPersonPicker v-if="!isPrefilled" v-model="form.recipient.value"
                                    :recipients="recipients" :error="form.fieldError('recipient')" />

                                <div class="task-field">
                                    <label class="task-label" :for="`${id}-what`">What needs doing?</label>
                                    <input :id="`${id}-what`" ref="titleInput" v-model="form.title.value"
                                        class="task-input" :class="{ 'is-invalid': form.fieldError('title') }"
                                        maxlength="120" placeholder="e.g. Physio session, collect medicine">
                                    <p v-if="form.fieldError('title')" class="task-field-error">{{ form.fieldError('title') }}</p>
                                </div>

                                <TaskCategoryPicker v-model="form.category.value" :error="form.fieldError('category')" />

                                <!-- 09b: with the person fixed, "When?" moves up into this column -->
                                <TaskWhenFields v-if="isPrefilled" v-model:date="form.date.value"
                                    v-model:start-time="form.startTime.value" v-model:end-time="form.endTime.value"
                                    :start-error="form.fieldError('startAt')"
                                    :end-error="form.fieldError('endAt') || form.errors.value.endAt" />
                            </div>

                            <div class="col-md-6 d-flex flex-column gap-4">
                                <TaskWhenFields v-if="!isPrefilled" v-model:date="form.date.value"
                                    v-model:start-time="form.startTime.value" v-model:end-time="form.endTime.value"
                                    :start-error="form.fieldError('startAt')"
                                    :end-error="form.fieldError('endAt') || form.errors.value.endAt" />

                                <TaskPlacePicker v-model="form.location.value"
                                    :suggestion="selectedRecipient?.preferredClinic"
                                    :suggestion-label="selectedRecipient ? `${recipientName}'s preferred clinic` : ''"
                                    :error="form.fieldError('location') || form.errors.value.location" />

                                <TaskTransitToggle v-model="form.needsTransit.value" :disabled="!form.location.value" />

                                <div class="task-field">
                                    <label class="task-label" :for="`${id}-notes`">
                                        Notes for the helper <span class="task-optional">(optional)</span>
                                    </label>
                                    <textarea :id="`${id}-notes`" v-model="form.description.value" class="task-input"
                                        :class="{ 'is-invalid': form.fieldError('description') || form.errors.value.description }"
                                        maxlength="2000" placeholder="Anything the helper should bring or know"></textarea>
                                    <p v-if="form.fieldError('description') || form.errors.value.description" class="task-field-error">
                                        {{ form.fieldError('description') || form.errors.value.description }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <p v-if="form.submitError.value" class="task-submit-error mt-4" role="alert">
                            <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
                            {{ form.submitError.value }}
                        </p>
                    </div>

                    <footer class="new-task-footer">
                        <p v-if="!form.canSubmit.value" class="footer-note is-missing" aria-live="polite">
                            {{ form.missingMessage.value }}
                        </p>
                        <p v-else class="footer-note" aria-live="polite">
                            <i class="bi bi-send" aria-hidden="true"></i>
                            The {{ familyLabel }} Telegram group gets a message when you {{ isEdit ? 'save' : 'post' }}
                        </p>
                        <button type="button" class="btn btn-light footer-button" @click="requestClose">Cancel</button>
                        <button type="submit" class="btn btn-primary footer-button post-button"
                            :disabled="!form.canSubmit.value || form.isSubmitting.value">
                            <span v-if="form.isSubmitting.value" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                            <template v-if="isEdit">{{ form.isSubmitting.value ? 'Saving...' : 'Save changes' }}</template>
                            <template v-else>{{ form.isSubmitting.value ? 'Posting...' : 'Post task' }}</template>
                        </button>
                    </footer>
                </form>
                </Transition>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.new-task-dialog {
    max-width: 900px;
}

.new-task-content {
    overflow: hidden;
    border: none;
    border-radius: 20px;
    box-shadow: 0 24px 60px rgba(20, 31, 23, 0.25);
}

.new-task-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 22px 28px;
    border-bottom: 1px solid var(--theme-border, #EEF0EC);
}

.header-icon,
.header-avatar {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
}

.header-icon {
    border-radius: 12px;
    background: var(--theme-soft, #E8F5E9);
    color: var(--theme-green, #2F7A3F);
    font-size: 20px;
}

.header-avatar {
    border-radius: 50%;
    background: var(--theme-warning-soft, #FDF3E4);
    color: var(--theme-danger, #A0703A);
    font-size: 14px;
    font-weight: 800;
}

.header-text {
    flex: 1;
    min-width: 0;
}

.header-text h2 {
    margin: 0 0 2px;
    font-size: 20px;
    font-weight: 700;
    color: var(--theme-text, #2F2F2F);
}

.header-text p {
    margin: 0;
    font-size: 13px;
    color: var(--theme-muted, #6B7280);
}

.change-person {
    padding: 0;
    border: none;
    background: none;
    color: var(--theme-green, #2F7A3F);
    font-weight: 600;
}

.change-person:hover {
    text-decoration: underline;
}

.close-button {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 10px;
    background: none;
    color: var(--theme-muted, #6B7280);
    font-size: 18px;
}

.close-button:hover {
    background: var(--theme-page, #F3F4F1);
}

.helper-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 28px;
    border-bottom: 1px solid var(--theme-border, #EEF0EC);
    background: var(--theme-page, #FBFBF7);
}

.helper-label {
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-muted, #6B7280);
}

.new-task-body {
    padding: 24px 28px;
}

.new-task-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 28px;
    border-top: 1px solid var(--theme-border, #EEF0EC);
    background: var(--theme-page, #FBFBF7);
}

.footer-note {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 12px;
    color: var(--theme-muted, #6B7280);
}

.footer-note.is-missing {
    color: var(--theme-danger, #9A3A2A);
}

.footer-button {
    min-height: 44px;
    padding: 0 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
}

.btn-light {
    border: 1px solid var(--theme-border, #E5E7EB);
    background: var(--theme-panel, white);
}

.post-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-color: var(--theme-accent-border, #2F7A3F);
    background: #2F7A3F;
}

.post-button:hover:not(:disabled) {
    border-color: var(--theme-accent-border, #256836);
    background: #256836;
}

.post-button:disabled {
    opacity: 0.45;
    border-color: var(--theme-accent-border, #2F7A3F);
    background: #2F7A3F;
}
</style>
