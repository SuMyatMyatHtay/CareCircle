
<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppNavigation from './components/layout/AppNavigation.vue'

const route = useRoute()

const standaloneScreen = computed(() =>
  [
    '/login',
    '/signup',
    '/home',
    '/create-family',
    '/join-family'
  ].includes(route.path)
)
</script>

<template>
  <RouterView v-if="standaloneScreen" />

  <template v-else>
    <AppNavigation />

    <main class="container py-4 pb-5">
      <RouterView />
    </main>

    <footer class="container small text-muted pb-4">
      CareCircle • Sample family and care information are fictional • UI handoff prototype
    </footer>
  </template>
</template>
