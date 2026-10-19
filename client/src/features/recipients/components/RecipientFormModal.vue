<script setup>
// Owner: Jhen (C)
// RecipientForm in a plain Vue overlay (no Bootstrap JS). Closes on Cancel, Escape
// and a successful save; emits "updated" with the saved recipient.
//   <RecipientFormModal v-if="editing" :recipient="recipient" @updated="replace" @close="editing = false" />
import { onMounted, onUnmounted } from 'vue'
import RecipientForm from './RecipientForm.vue'
import { useRecipients } from '../../../composables/useRecipients.js'

const props = defineProps({
    recipient: { type: Object, default: null }
})

const emit = defineEmits(['updated', 'close'])

const { refresh } = useRecipients()

function onSaved(recipient) {
    refresh()
    emit('updated', recipient)
    emit('close')
}

function onKeydown(event) {
    if (event.key === 'Escape') emit('close')
}

onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
})
</script>

<template>
    <div class="modal-overlay" @click.self="emit('close')">
        <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="recipient-modal-title">
            <header class="modal-header-row">
                <h2 id="recipient-modal-title">{{ props.recipient ? 'Edit care recipient' : 'Add care recipient' }}</h2>
                <button type="button" class="close-button" aria-label="Close" @click="emit('close')">
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
            </header>

            <RecipientForm :recipient="props.recipient" @saved="onSaved" @cancel="emit('close')" />
        </section>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 16px;
    overflow-y: auto;
    background: rgba(46, 46, 46, 0.45);
}

.modal-panel {
    width: 100%;
    max-width: 720px;
    padding: 28px;
    background: white;
    border: 1px solid #E4ECE5;
    border-radius: 20px;
}

.modal-header-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
}

.modal-header-row h2 {
    flex: 1;
    margin: 0;
    font-size: 24px;
    font-weight: 800;
    color: #2F2F2F;
}

.close-button {
    padding: 4px;
    border: none;
    background: none;
    color: #7B8391;
    font-size: 18px;
}

@media (max-width: 575px) {
    .modal-overlay {
        padding: 0;
    }

    .modal-panel {
        min-height: 100%;
        padding: 20px 16px;
        border-radius: 0;
    }
}
</style>
