<script setup>
import { ref } from 'vue'
const props = defineProps({
  user: { type: Object, required: true },
  busy: Boolean,
  error: { type: String, default: '' },
})
defineEmits(['save', 'cancel'])
const name = ref(props.user.name || ''),
  phone = ref(props.user.phone || '')
</script>
<template>
  <form
    class="care-form"
    @submit.prevent="$emit('save', { name: name.trim(), phone: phone.trim() })"
  >
    <p class="care-muted care-small">{{ user.email }}</p>
    <label>
      Name
      <input
        v-model="name"
        :disabled="busy"
        required
        minlength="2"
        maxlength="80"
        autocomplete="name"
      />
    </label>
    <label>
      Phone
      <input
        v-model="phone"
        :disabled="busy"
        type="tel"
        maxlength="30"
        autocomplete="tel"
        placeholder="Optional"
      />
    </label>
    <p v-if="error" class="care-error care-small" role="alert">{{ error }}</p>
    <div class="care-modal-actions">
      <button
        type="button"
        class="care-button"
        :disabled="busy"
        @click="$emit('cancel')"
      >
        Cancel
      </button>
      <button
        class="care-button care-button--primary"
        :disabled="busy || name.trim().length < 2"
      >
        {{ busy ? 'Saving…' : 'Save profile' }}
      </button>
    </div>
  </form>
</template>
