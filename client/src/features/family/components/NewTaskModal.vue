<script setup>
import { ref } from 'vue'
import CareModal from '../../../components/common/CareModal.vue'
defineProps({
  recipients: { type: Array, default: () => [] },
  busy: Boolean,
  error: { type: String, default: '' },
})
defineEmits(['close', 'save'])
const title = ref(''),
  recipient = ref(''),
  location = ref('')
const date = ref(
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(
    new Date(),
  ),
)
const time = ref('14:00')
</script>
<template>
  <CareModal title="A little help goes a long way" @close="$emit('close')">
    <p class="care-muted care-small">
      Post a task so someone in your family can lend a hand.
    </p>
    <form
      class="care-form"
      @submit.prevent="
        $emit('save', {
          title: title.trim(),
          recipient: recipient || null,
          startAt: new Date(`${date}T${time}:00+08:00`).toISOString(),
          location: { name: location.trim() },
          category: 'other',
        })
      "
    >
      <label>
        Task name
        <input
          v-model="title"
          required
          maxlength="160"
          placeholder="e.g. Pick up Grandma’s medication"
          autofocus
        />
      </label>
      <label>
        Who is it for?
        <select v-model="recipient">
          <option value="">The household</option>
          <option
            v-for="person in recipients"
            :key="person._id"
            :value="person._id"
          >
            {{ person.nickname || person.name }}
          </option>
        </select>
      </label>
      <div class="care-form-row">
        <label>
          Date
          <input v-model="date" type="date" required />
        </label>
        <label>
          Time (Singapore)
          <input v-model="time" type="time" required />
        </label>
      </div>
      <label>
        Location
        <input v-model="location" maxlength="200" placeholder="Optional" />
      </label>
      <p v-if="error" class="care-error" role="alert">{{ error }}</p>
      <div class="care-modal-actions">
        <button
          type="button"
          class="care-button"
          :disabled="busy"
          @click="$emit('close')"
        >
          Cancel
        </button>
        <button
          class="care-button care-button--primary"
          :disabled="busy || !title.trim()"
        >
          {{ busy ? 'Posting…' : 'Post task' }}
        </button>
      </div>
    </form>
  </CareModal>
</template>
