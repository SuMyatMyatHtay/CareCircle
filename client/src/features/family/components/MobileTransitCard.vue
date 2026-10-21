<script setup>
import { computed } from 'vue'
import CareAvatar from '../../../components/common/CareAvatar.vue'
const props = defineProps({ session: { type: Object, default: null } })
defineEmits(['view'])
const headline = computed(
  () =>
    props.session?.mobileHeadline ||
    props.session?.headline?.split(' with ')[0] ||
    'Your family is on the move',
)
const detail = computed(() =>
  [
    props.session?.companion?.name
      ? `with ${props.session.companion.name}`
      : '',
    props.session?.detail?.split(' · ')[0],
  ]
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <button
    v-if="session"
    class="care-mobile-transit"
    @click="$emit('view')"
    aria-label="View live transit timeline"
  >
    <span class="care-mobile-transit-avatars">
      <CareAvatar :person="session.recipient" size="small" />
      <CareAvatar :person="session.companion" size="tiny" />
    </span>
    <span class="care-mobile-transit-copy">
      <span class="care-mobile-transit-label">LIVE · TRANSIT</span>
      <strong>{{ headline }}</strong>
      <small>{{ detail }}</small>
    </span>
  </button>
</template>
