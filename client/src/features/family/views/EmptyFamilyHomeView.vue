<script setup>
import '../../../styles/emptyFamilyHomeView.css'
import { ref, computed } from 'vue'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'

// Families, selection, loading and errors come from the shared layout state.
// The sidebar and the family loading now live in AppLayout.vue.
const { families, selectedFamily, isLoading, errorMessage, loadFamilies } = useActiveFamily()

const user = ref({})

try {
  user.value = JSON.parse(
    sessionStorage.getItem('user') || '{}'
  )
} catch {
  user.value = {}
}

const firstName = computed(() =>
  user.value.name?.trim().split(/\s+/)[0] || 'friend'
)

const greeting = computed(() => {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})
</script>

<template>
  <div class="home-page">
    <header class="main-header">
      <div>
        <h1>{{ greeting }}, {{ firstName }}!</h1>
        <p>
          {{ selectedFamily
            ? `Welcome to ${selectedFamily.name} ♡`
            : 'Care together, closer always ♡'
          }}
        </p>
      </div>
    </header>

    <!-- LOADING -->
    <div v-if="isLoading" class="status-screen" role="status">
      <div class="spinner-border text-success" aria-hidden="true"></div>
      <p>Gathering your family circles...</p>
    </div>

    <!-- API ERROR -->
    <section v-else-if="errorMessage" class="empty-state">
      <div class="empty-illustration">🌧️</div>

      <h2>Oops! We couldn't load your families.</h2>
      <p>{{ errorMessage }}</p>

      <button class="primary-action" @click="loadFamilies">
        Try again
      </button>
    </section>

    <!-- NO FAMILY YET -->
    <section v-else-if="families.length === 0" class="empty-state">
      <div class="empty-illustration">🏡💗🌷</div>
      <div class="small-tag">♡ YOUR STORY STARTS HERE ♡</div>

      <h2>No family circle yet!</h2>

      <p>
        Every caring journey starts with a little circle of love.
        Create your own family or join your loved ones to
        start caring together!
      </p>

      <div class="empty-actions">
        <RouterLink to="/create-family" class="primary-action">
          <i class="bi bi-plus-lg"></i>
          Create a family
        </RouterLink>

        <RouterLink to="/join-family" class="secondary-action">
          <i class="bi bi-person-plus"></i>
          Join a family
        </RouterLink>
      </div>

      <div class="bottom-message">
        🌱 Little acts of care make a big difference.
      </div>
    </section>

    <!-- FAMILY EXISTS, NO DASHBOARD CONTENT YET -->
    <section v-else class="family-workspace">
      <!-- Actual care recipients, tasks, activity, etc.
           will be implemented here later. -->
    </section>
  </div>
</template>