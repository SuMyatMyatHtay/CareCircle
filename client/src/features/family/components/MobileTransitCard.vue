<script setup>
import { computed } from 'vue'
import ProfileAvatar from '../../../components/common/ProfileAvatar.vue'
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
  <div
    v-if="session"
    class="care-mobile-transit"
  >
    <span class="care-mobile-transit-avatars">
      <ProfileAvatar :person="session.recipient" recipient size="small" />
      <ProfileAvatar :person="session.companion" size="tiny" />
    </span>
    <button type="button" class="care-mobile-transit-copy care-transit-open" @click="$emit('view')" aria-label="View live transit timeline">
      <span class="care-mobile-transit-label">LIVE · TRANSIT</span>
      <strong>{{ headline }}</strong>
      <small>{{ detail }}</small>
    </button>
  </div>
</template>
<style scoped>
.care-transit-open{border:0;background:none;padding:0;text-align:left;color:inherit;font:inherit;flex:1}.care-transit-open:focus-visible{outline:2px solid var(--care-green,#2d7d43);outline-offset:3px}
</style>
