<script setup>
import { computed } from 'vue'
const props = defineProps({
  person: { type: Object, default: () => ({}) },
  size: { type: String, default: 'normal' },
})
const initials = computed(() =>
  (props.person.nickname || props.person.name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join(''),
)
</script>

<template>
  <span class="care-avatar" :class="`care-avatar--${size}`" aria-hidden="true">
    {{ person.avatar || initials }}
  </span>
</template>

<style scoped>
.care-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--care-soft, #e8f4eb);
  color: var(--care-green, #2d7d43);
  font-size: 27px;
  font-weight: 700;
}
.care-avatar--small {
  width: 30px;
  height: 30px;
  font-size: 19px;
}
.care-avatar--tiny {
  width: 24px;
  height: 24px;
  font-size: 15px;
}
</style>
