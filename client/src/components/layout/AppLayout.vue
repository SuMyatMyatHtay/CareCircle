
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import FamilySidebar from './FamilySidebar.vue'
import { useActiveFamily } from '../../composables/useActiveFamily.js'

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
      />
    </div>

    <!-- Main content -->
    <div class="app-content flex-grow-1">

      <header class="app-topbar d-flex align-items-center justify-content-between px-3 px-md-4">
        <div class="d-flex align-items-center gap-3">
          <button
            type="button"
            class="btn app-menu-button"
            :aria-expanded="sidebarOpen"
            aria-label="Toggle navigation menu"
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

<style scoped>
.app-layout {
  min-height: 100vh;
  background: #FCFBF8;
  color: #2F2F2F;
  font-family: 'Nunito', system-ui, sans-serif;
}

.sidebar-wrapper {
  width: 264px;
  flex: 0 0 264px;
  min-width: 0;
  overflow: hidden;
  transition: width 0.25s ease, flex-basis 0.25s ease;
}

.sidebar-wrapper.sidebar-hidden {
  width: 0;
  flex-basis: 0;
}

.app-content {
  min-width: 0;
}

.app-topbar {
  min-height: 70px;
  background: white;
  border-bottom: 1px solid #E5EDE6;
}

.app-menu-button {
  color: #398A51;
  background: #E8F5E9;
  border: none;
}

.app-menu-button:hover {
  background: #D6ECD9;
}

.app-topbar-brand {
  color: #398A51;
  font-size: 19px;
}

.app-profile-button {
  color: #398A51;
  border: 1px solid #B5DDC0;
}

.app-profile-button:hover {
  background: #E8F5E9;
  color: #2E7D43;
}

.app-main {
  padding: 0 32px 32px;
}

@media (max-width: 767.98px) {
  .sidebar-wrapper,
  .sidebar-wrapper.sidebar-hidden {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 1050;
    width: 264px;
    flex-basis: 264px;
    overflow: visible;
    transition: transform 0.25s ease;
  }

  .sidebar-wrapper.sidebar-hidden {
    transform: translateX(-100%);
    pointer-events: none;
  }

  .sidebar-overlay {
    position: fixed;
    inset: 0;
    z-index: 1040;
    background: rgba(33, 48, 38, 0.35);
  }

  .app-main {
    padding: 0 18px 25px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-wrapper {
    transition: none;
  }
}
</style>
