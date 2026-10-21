<script setup>
import { useAppAppearance } from './features/settings/composables/useAppearance.js'
useAppAppearance()
</script>

<template>
  <!-- Which frame a page gets is decided in router/index.js:
       pages under AppLayout get the sidebar, the rest render on their own. -->
  <RouterView :key="$route.meta.preview ? 'preview' : 'app'" />
</template>
