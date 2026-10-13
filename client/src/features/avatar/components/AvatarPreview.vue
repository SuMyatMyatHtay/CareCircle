<script setup>
import { computed, ref, watch } from 'vue'
import { findItem } from '../data/avatarWardrobe.js'
const props = defineProps({ appearance: { type: Object, required: true } })
const broken = ref({})
const layers = computed(() => {
  const e = props.appearance?.equipped || {}
  return [
    findItem('bases', props.appearance?.baseId),
    findItem('bottoms', e.bottom),
    findItem('tops', e.top),
    findItem('shoes', e.shoes),
    findItem('accessories', e.accessory)
  ].filter(Boolean)
})
watch(layers, () => { broken.value = {} })
</script>
<template>
  <div class="avatar-canvas mx-auto" role="img" aria-label="Preview of customized avatar">
    <img v-for="(layer, index) in layers" :key="layer.id" v-show="!broken[layer.id]"
      :src="layer.image" :style="{ zIndex: index + 1 }" class="avatar-image-layer" alt=""
      draggable="false" @error="broken[layer.id] = true" />
    <div v-if="!layers.length || broken[appearance.baseId]" class="avatar-empty d-flex flex-column align-items-center justify-content-center text-center px-3">
      <i class="bi bi-person-bounding-box fs-1 mb-2"></i>
      <strong>Your avatar goes here ♡</strong>
      <span class="small mt-2">Add aligned transparent PNGs to public/avatars to see the live layers.</span>
    </div>
  </div>
</template>
