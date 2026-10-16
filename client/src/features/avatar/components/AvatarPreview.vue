<script setup>
import { computed, ref, watch } from 'vue'
import { findItem, categoryForBottom } from '../data/avatarWardrobe.js'

const props = defineProps({
  appearance: { type: Object, required: true }
})
const failed = ref({})
const layers = computed(() => {
  const a = props.appearance || {}
  const e = a.equipped || {}
  const bottomType = categoryForBottom(e.bottom)
  return [
    ['base', findItem('bases', a.baseId)],
    ...(e.dress
      ? [['dress', findItem('dresses', e.dress)]]
      : [
          ['bottom', bottomType ? findItem(bottomType, e.bottom) : null],
          ['top', findItem('tops', e.top)]
        ]),
    ['accessory', findItem('accessories', e.accessory)]
  ].filter(([, item]) => Boolean(item))
})
watch(layers, () => { failed.value = {} })
</script>

<template>
  <div class="cc-avatar" role="img" :aria-label="`${appearance.baseId || 'Pet'} wearing selected clothes`">
    <img
      v-for="([type, item], index) in layers"
      :key="`${type}-${item.id}`"
      v-show="!failed[item.id]"
      :src="item.image"
      :class="[
        'cc-avatar-layer',
        `cc-avatar-${type}`,
        type === 'bottom' ? (item.id.startsWith('skirts-') ? 'cc-avatar-skirt' : 'cc-avatar-shorts') : ''
      ]"
      :style="{ zIndex: index + 1 }"
      alt=""
      draggable="false"
      @error="failed[item.id] = true"
    />
    <div v-if="failed[appearance.baseId]" class="cc-avatar-warning">Character image missing</div>
  </div>
</template>

<style scoped>
.cc-avatar { position: relative; width: 100%; aspect-ratio: 1; isolation: isolate; }
.cc-avatar-layer { position: absolute; display: block; object-fit: contain; pointer-events: none; user-select: none; }
.cc-avatar-base { inset: 0; width: 100%; height: 100%; }
.cc-avatar-dress { left: 29%; top: 53%; width: 38%; height: 35%; }
.cc-avatar-top { left: 24%; top: 55%; width: 44%; height: 27%; }
.cc-avatar-bottom { left: 24%; top: 66%; width: 32%; height: 23%; }
.cc-avatar-skirt { top: 66%; left: 27%; width: 36%; height: 22%; }
.cc-avatar-shorts { top: 69%; left: 32%; width: 28%; height: 22%; }
.cc-avatar-accessory { left: 17%; top: 4%; width: 66%; height: 44%; }
.cc-avatar-warning { position: absolute; inset: 0; display: grid; place-items: center; color: #B46D66; }
</style>
