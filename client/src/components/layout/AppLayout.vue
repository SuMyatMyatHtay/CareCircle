
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import FamilySidebar from './FamilySidebar.vue'
import { useActiveFamily } from '../../composables/useActiveFamily.js'
import '../../styles/appLayout.css'

const { families, selectedFamilyId, loadFamilies, selectFamily } =
  useActiveFamily()

const sidebarOpen = ref(window.innerWidth >= 768)
const user = ref({})

function refreshSidebarUser() {
  try {
    user.value = JSON.parse(sessionStorage.getItem('user') || '{}')
  } catch {
    user.value = {}
  }
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeMobileSidebar() {
  if (window.innerWidth < 768) {
    sidebarOpen.value = false
  }
}

function handleResize() {
  sidebarOpen.value = window.innerWidth >= 768
}

refreshSidebarUser()

onMounted(() => {
  loadFamilies()
  window.addEventListener('resize', handleResize)
  window.addEventListener('carecircle:profile-updated', refreshSidebarUser)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('carecircle:profile-updated', refreshSidebarUser)
})
</script>

<template>
  <div class="app-layout d-flex">

    <!-- Overlay on mobile -->
    <div
      v-if="sidebarOpen"
      class="sidebar-overlay d-md-none"
      @click="closeMobileSidebar"
    ></div>

    <!-- Collapsible sidebar -->
    <div
      class="sidebar-wrapper"
      :class="{ 'sidebar-hidden': !sidebarOpen }"
    >
      <FamilySidebar
        :families="families"
        :selected-family-id="selectedFamilyId"
        :user="user"
        @select-family="selectFamily"
        @navigate="closeMobileSidebar"
        @collapse="toggleSidebar"
      />
    </div>

    <!-- Main content -->
    <div class="app-content flex-grow-1">

      <header class="app-topbar d-flex align-items-center justify-content-between px-3 px-md-4">
        <div class="d-flex align-items-center gap-3">
          <button
            v-if="!sidebarOpen"
            type="button"
            class="btn app-menu-button"
            aria-label="Open navigation menu"
            @click="toggleSidebar"
          >
            <i class="bi bi-list fs-4"></i>
          </button>

          <RouterLink
            to="/home"
            class="text-decoration-none fw-bold app-topbar-brand"
          >
            <i class="bi bi-heart-pulse me-2"></i>
            CareCircle
          </RouterLink>
        </div>

        <RouterLink
          to="/profile"
          class="btn app-profile-button rounded-pill"
        >
          <i class="bi bi-person-circle me-1"></i>
          <span class="d-none d-sm-inline">My Profile</span>
        </RouterLink>
      </header>

      <main class="app-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

