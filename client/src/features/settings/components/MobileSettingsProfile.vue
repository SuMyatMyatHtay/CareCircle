<script setup>
import CareAvatar from '../../../components/common/CareAvatar.vue'
defineProps({
  user: { type: Object, required: true },
  role: { type: String, default: 'member' },
  preview: Boolean,
})
defineEmits(['edit'])
</script>
<template>
  <header class="care-mobile-settings-profile">
    <CareAvatar :person="user" />
    <div class="care-mobile-settings-identity">
      <h1>{{ user.name || 'My profile' }}</h1>
      <p>
        {{ user.email }}
        <span v-if="role">· {{ role === 'admin' ? 'Admin' : 'Member' }}</span>
      </p>
      <span v-if="preview" class="care-mobile-settings-preview">
        Preview · sample family
      </span>
    </div>
    <button class="care-button" @click="$emit('edit')">Edit</button>
  </header>
</template>
