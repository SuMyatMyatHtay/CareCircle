<script setup>
// Owner: SeungHak (F)
// Small green confirmation at the top of the screen, e.g. "Note saved to Grandma's log".
// Hides itself after a few seconds.
import { onUnmounted, watch } from 'vue'

const props = defineProps({ message: { type: String, default: '' } })
const emit = defineEmits(['close'])

let timer = null
watch(() => props.message, (message) => {
    clearTimeout(timer)
    if (message) timer = setTimeout(() => emit('close'), 3500)
}, { immediate: true })
onUnmounted(() => clearTimeout(timer))
</script>

<template>
    <Teleport to="body">
        <Transition name="toast">
            <div v-if="message" class="saved-toast" role="status" data-testid="saved-toast">
                <i class="bi bi-check-circle-fill" aria-hidden="true"></i>
                <span>{{ message }}</span>
                <button type="button" aria-label="Dismiss" @click="emit('close')">
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.saved-toast {
    position: fixed;
    top: 16px;
    left: 50%;
    z-index: 1200;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100vw - 32px);
    padding: 10px 14px;
    border-radius: 999px;
    background: #3B7A4F;
    color: white;
    font-size: 14px;
    font-weight: 700;
    box-shadow: 0 6px 20px rgba(20, 35, 25, 0.2);
}

.saved-toast button {
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.8;
}

.toast-enter-active,
.toast-leave-active {
    transition: opacity 0.2s, transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translate(-50%, -8px);
}
</style>
