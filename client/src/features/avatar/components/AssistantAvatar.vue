<script setup>
import { computed } from 'vue'
import AvatarPreview from './AvatarPreview.vue'
import { normalizeAppearance } from '../data/avatarWardrobe.js'

const props = defineProps({
  appearance: { type: Object, default: null },
  size: { type: String, default: 'normal' }
})
const savedLook = computed(() => normalizeAppearance(props.appearance))
</script>

<template>
  <span class="assistant-avatar" :class="`assistant-avatar--${size}`" role="img" aria-label="CareCircle assistant wearing your avatar's outfit">
    <span class="assistant-avatar-crop" aria-hidden="true">
      <AvatarPreview :appearance="savedLook" />
    </span>
  </span>
</template>

<style scoped>
.assistant-avatar {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: 50%;
  isolation: isolate;
  vertical-align: middle;
  background: radial-gradient(circle at 50% 30%, var(--theme-panel, #fff), var(--theme-soft, #e6f3e9));
  box-shadow: inset 0 0 0 1px var(--theme-border, #dce9df);
}
/* Zoom the complete layered avatar together, retaining hats and the neckline. */
.assistant-avatar-crop { position: absolute; width: 160%; left: -30%; top: -10%; }
.assistant-avatar--small { width: 36px; height: 36px; }
.assistant-avatar--large { width: 72px; height: 72px; }
</style>
