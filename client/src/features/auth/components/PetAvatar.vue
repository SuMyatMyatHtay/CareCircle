<script setup>
import { computed } from 'vue'

const props = defineProps({
  appearance: { type: Object, default: () => ({}) },
  showBackground: { type: Boolean, default: true }
})

const images = import.meta.glob('../../../assets/pets/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})
const findAsset = (path) => images[`../../../assets/pets/${path}`] || null
const species = computed(() => ['fox', 'cat'].includes(props.appearance?.species) ? props.appearance.species : 'fox')
const equipped = computed(() => props.appearance?.equipped || {})
const base = computed(() => findAsset(`${species.value}.png`))
const top = computed(() => equipped.value.outfit ? findAsset(`tops/${equipped.value.outfit}.png`) : null)
const bottom = computed(() => {
  const id = equipped.value.bottom || ''
  const folder = id.startsWith('skirts-') ? 'skirts' : id.startsWith('shorts-') ? 'shorts' : ''
  return folder ? findAsset(`${folder}/${id}.png`) : null
})
</script>

<template>
  <div class="pet-avatar" :class="{ 'pet-avatar--clear': !showBackground, 'pet-avatar--fox': species === 'fox' }" role="img" :aria-label="`${species} avatar with selected clothes`">
    <img v-if="base" class="pet-avatar__base" :src="base" alt="" draggable="false" />
    <img v-if="top" class="pet-avatar__part pet-avatar__top" :src="top" alt="" draggable="false" />
    <img v-if="bottom" class="pet-avatar__part pet-avatar__bottom" :src="bottom" alt="" draggable="false" />
  </div>
</template>

<style scoped>
.pet-avatar { position: relative; width: 100%; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 26px; background: radial-gradient(circle at 50% 45%, var(--theme-panel, #fff) 0%, var(--theme-soft, #eaf7ed) 70%, var(--theme-danger-soft, #ffebed) 100%); isolation: isolate; }
.pet-avatar--clear { background: transparent; }
.pet-avatar img { display: block; position: absolute; object-fit: contain; pointer-events: none; user-select: none; }
.pet-avatar__base { width: 100%; height: 94%; left: 0; bottom: 0; }
.pet-avatar__part { filter: drop-shadow(0 2px 1px rgba(80,52,78,.1)); }
.pet-avatar__top { width: 78%; height: 39%; left: 11%; top: 39%; z-index: 2; }
.pet-avatar__bottom { width: 60%; height: 25%; left: 20%; top: 67%; z-index: 3; }
</style>
