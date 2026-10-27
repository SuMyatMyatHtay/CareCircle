<script setup>
import { computed, inject } from 'vue'
import { RouterLink, routeLocationKey } from 'vue-router'
import CareAvatar from './CareAvatar.vue'
const props = defineProps({
  person: { type: Object, default: () => ({}) },
  size: { type: String, default: 'normal' },
  recipient: Boolean,
})
const route = inject(routeLocationKey, null)
const idOf = value => value?._id || value?.id || (typeof value === 'string' ? value : '')
const target = computed(() => {
  if (!route || route.meta.preview) return null
  const userId = props.recipient ? idOf(props.person.linkedUser) : idOf(props.person)
  if (userId) {
    let ownId = ''
    try { ownId = JSON.parse(sessionStorage.getItem('user') || '{}').id } catch { /* no cached account */ }
    return userId === ownId ? '/profile' : `/profile/${encodeURIComponent(userId)}`
  }
  const recipientId = props.recipient && idOf(props.person)
  return recipientId ? `/recipients/${encodeURIComponent(recipientId)}/profile` : null
})
const label = computed(() => `View ${props.person.nickname || props.person.name || 'member'}'s profile`)
</script>
<template>
  <RouterLink v-if="target" :to="target" class="care-profile-avatar-link" :aria-label="label" :title="label" @click.stop><CareAvatar :person="person" :size="size" /></RouterLink>
  <CareAvatar v-else :person="person" :size="size" />
</template>
<style scoped>
.care-profile-avatar-link{display:inline-flex;flex-shrink:0;border-radius:50%;text-decoration:none}.care-profile-avatar-link:focus-visible{outline:2px solid var(--care-green,#2d7d43);outline-offset:3px}.care-profile-avatar-link:hover{filter:brightness(.95)}
</style>
