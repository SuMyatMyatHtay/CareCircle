<script setup>
import ProfileAvatar from '../../../components/common/ProfileAvatar.vue'
defineProps({ session: { type: Object, default: null } })
defineEmits(['view'])
</script>
<template>
  <section
    v-if="session"
    class="care-transit-banner"
    aria-label="Active transit"
  >
    <div class="care-avatar-pair">
      <ProfileAvatar :person="session.recipient" recipient />
      <ProfileAvatar :person="session.companion" />
    </div>
    <div class="care-transit-text">
      <span class="care-transit-label">LIVE · TRANSIT MODE</span>
      <h2>{{ session.headline }}</h2>
      <p>{{ session.detail }}</p>
    </div>
    <button class="care-button" @click="$emit('view')">View live</button>
  </section>
</template>
