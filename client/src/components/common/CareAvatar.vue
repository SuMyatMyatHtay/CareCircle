<script setup>
import { computed, ref, watch } from 'vue'
import { defaultProfilePicture } from './profilePictures.js'
const props = defineProps({
  person: { type: Object, default: () => ({}) },
  size: { type: String, default: 'normal' },
})
const failed = ref(false)
const picture = computed(() => props.person.profilePicture || defaultProfilePicture(props.person))
watch(picture, () => { failed.value = false })
</script>

<template>
  <span class="care-avatar" :class="`care-avatar--${size}`" aria-hidden="true">
    <img :src="failed ? defaultProfilePicture(person) : picture" alt="" @error="failed = true" />
  </span>
</template>

<style scoped>
.care-avatar img { width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
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
.care-avatar--profile { width: 104px; height: 104px; box-shadow: 0 0 0 5px var(--theme-soft, #eef6ef); }
.care-avatar--preview { width: 128px; height: 128px; box-shadow: 0 0 0 6px var(--theme-soft, #eef6ef); }
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
