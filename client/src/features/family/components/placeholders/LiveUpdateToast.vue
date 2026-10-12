<script setup>
// PLACEHOLDER (owner: D, Marcus). Toast shown when a task changes live.
// Static for now; Socket.IO events will drive it later.
import BlankLine from './BlankLine.vue'

defineProps({
    avatar: { type: String, default: '' },
    message: { type: String, default: '' }
})

const emit = defineEmits(['close'])
</script>

<template>
    <div class="live-toast" role="status">
        <span v-if="avatar" class="avatar" aria-hidden="true">{{ avatar }}</span>
        <div class="toast-text">
            <template v-if="message">
                <strong>{{ message }}</strong>
                <small><span class="dot"></span> Live · the board updated without a refresh</small>
            </template>
            <template v-else>
                <BlankLine width="200px" />
                <BlankLine width="140px" height="9px" />
            </template>
        </div>
        <button type="button" class="close" aria-label="Dismiss" @click="emit('close')">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
    </div>
</template>

<style scoped>
.live-toast {
    position: fixed;
    right: 24px;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    z-index: 1050;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: calc(100vw - 32px);
    padding: 12px 14px;
    border-radius: 12px;
    background: #2F2F2F;
    color: white;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
}

.avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: white;
    font-size: 19px;
}

.toast-text {
    display: flex;
    flex-direction: column;
}

strong {
    font-size: 14px;
}

small {
    color: #7FD49A;
    font-size: 12px;
}

.dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 3px;
    border-radius: 50%;
    background: #7FD49A;
}

.close {
    padding: 4px;
    border: none;
    background: none;
    color: #B9B9B9;
}

@media (max-width: 575px) {
    .live-toast {
        right: 16px;
        left: 16px;
    }
}
</style>
