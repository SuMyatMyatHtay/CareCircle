<script setup>
// "+ New task" button. At md and up it opens NewTaskModal; on phones it goes to the
// full-page form (/tasks/new). Pass a recipient to pre-fill "who is it for".
//   <NewTaskButton :recipient="recipient" />
// With save (the /preview page) it always opens the modal, since there is no API to post to.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import NewTaskModal from './NewTaskModal.vue'

const props = defineProps({
    recipient: { type: Object, default: null },
    save: { type: Function, default: null }
})

const emit = defineEmits(['created'])

const router = useRouter()
const modalOpen = ref(false)

// Same breakpoint as Bootstrap's md
const MD_UP = '(min-width: 768px)'

function create() {
    if (props.save || window.matchMedia(MD_UP).matches) {
        modalOpen.value = true
        return
    }
    router.push({ name: 'task-new', query: props.recipient ? { recipient: props.recipient._id } : {} })
}
</script>

<template>
    <button type="button" class="new-task-button" @click="create">
        <i class="bi bi-plus-lg" aria-hidden="true"></i>
        New task
    </button>

    <NewTaskModal v-if="modalOpen" :recipient="recipient" :save="save" @created="emit('created', $event)"
        @close="modalOpen = false" />
</template>

<style scoped>
.new-task-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 11px 18px;
    border: none;
    border-radius: 10px;
    background: #2E7D43;
    color: white;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
}

.new-task-button:hover {
    background: #256836;
}

.new-task-button:focus-visible {
    outline: 3px solid var(--theme-accent-border, #A8D5B5);
    outline-offset: 2px;
}
</style>
