
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AssistantLauncher from '../../features/avatar/components/AssistantLauncher.vue'
import FamilySidebar from './FamilySidebar.vue'
import RecipientSummaryModal from '../../features/family/components/RecipientSummaryModal.vue'
import { provideFamilyWorkspace } from '../../features/family/composables/useFamilyWorkspace.js'
import { resetPreview } from '../../features/family/data/previewFamily.js'
import { queryClient } from '../../services/queryClient.js'
import '../../styles/appLayout.css'
import '../../styles/familyWorkspace.css'

const route = useRoute()
const { families, selectedFamilyId, loadFamilies, selectFamily, recipients, recipientsLoading, recipientsError, user, refreshUser, isPreview, homePath, settingsPath } = provideFamilyWorkspace(route.meta.preview === true)
const isFamilyPage = computed(() => ['home', 'family-settings', 'preview-home', 'preview-settings'].includes(route.name))
const isHomePage = computed(() => ['home', 'preview-home'].includes(route.name))
const isSettingsPage = computed(() => ['family-settings', 'preview-settings'].includes(route.name))
const selectedRecipient = ref(null)
watch(selectedFamilyId, () => { selectedRecipient.value = null })
function showRecipient(event) { selectedRecipient.value = event.detail }
function onProfileUpdated() {
  refreshUser()
  if (!isPreview) queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === 'families' && query.queryKey[2] === 'recipients' })
}

const sidebarOpen = ref(window.innerWidth >= 768)
const isMobile = ref(window.innerWidth < 768)
watch(isHomePage, (isHome) => { if (isHome && isMobile.value) sidebarOpen.value = false })
watch(isSettingsPage, (isSettings) => { if (isSettings && isMobile.value) sidebarOpen.value = false })

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeMobileSidebar() {
  if (window.innerWidth < 768) {
    sidebarOpen.value = false
  }
}

function handleResize() {
  isMobile.value = window.innerWidth < 768
  sidebarOpen.value = window.innerWidth >= 768
}
function handleKeydown(event) {
  if (event.key === 'Escape') closeMobileSidebar()
}

onMounted(() => {
  loadFamilies()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('carecircle:profile-updated', onProfileUpdated)
  window.addEventListener('carecircle:open-recipient', showRecipient)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('carecircle:profile-updated', onProfileUpdated)
  window.removeEventListener('carecircle:open-recipient', showRecipient)
})
</script>

<template>
  <div class="app-layout d-flex" :class="{ 'family-surface': isFamilyPage, 'family-home-surface': isHomePage, 'family-settings-surface': isSettingsPage }">

    <!-- Overlay on mobile -->
    <div
      v-if="sidebarOpen"
      class="sidebar-overlay d-md-none"
      @click="closeMobileSidebar"
    ></div>

    <!-- Collapsible sidebar -->
    <div
      class="sidebar-wrapper"
      id="family-navigation"
      :inert="!sidebarOpen"
      :class="{ 'sidebar-hidden': !sidebarOpen }"
    >
      <FamilySidebar
        :families="families"
        :selected-family-id="selectedFamilyId"
        :user="user"
        :recipients="recipients"
        :recipients-loading="recipientsLoading"
        :recipients-error="recipientsError"
        :preview="isPreview"
        :home-path="homePath"
        :settings-path="settingsPath"
        @select-family="selectFamily"
        @navigate="closeMobileSidebar"
        @collapse="toggleSidebar"
        @open-recipient="selectedRecipient = $event; closeMobileSidebar()"
      />
    </div>

    <!-- Main content -->
    <div class="app-content flex-grow-1" :inert="isMobile && sidebarOpen">

      <header class="app-topbar d-flex align-items-center justify-content-between px-3 px-md-4" :class="{ 'care-hidden-topbar': sidebarOpen }">
        <div class="d-flex align-items-center gap-3">
          <button
            v-if="!sidebarOpen"
            type="button"
            class="btn app-menu-button"
            aria-label="Open navigation menu"
            aria-controls="family-navigation"
            :aria-expanded="sidebarOpen"
            @click="toggleSidebar"
          >
            <i class="bi bi-list fs-4"></i>
          </button>

          <RouterLink
            :to="homePath"
            class="text-decoration-none fw-bold app-topbar-brand"
          >
            <i class="bi bi-heart-pulse me-2"></i>
            CareCircle
          </RouterLink>
        </div>

        <RouterLink
          v-if="!isPreview"
          to="/profile"
          class="btn app-profile-button rounded-pill"
        >
          <i class="bi bi-person-circle me-1"></i>
          <span class="d-none d-sm-inline">My Profile</span>
        </RouterLink>
      </header>

      <main class="app-main">
        <div v-if="isPreview" class="care-preview-bar"><span><i class="bi bi-eye" aria-hidden="true"></i> Preview · sample family data</span><button @click="resetPreview">Reset sample</button><RouterLink to="/login">Back to login <i class="bi bi-arrow-up-right" aria-hidden="true"></i></RouterLink></div>
        <RouterView />
      </main>
      <AssistantLauncher v-if="!isPreview" :user="user" :inert="isMobile && sidebarOpen" />
      <RecipientSummaryModal v-if="selectedRecipient" :recipient="selectedRecipient" @close="selectedRecipient = null" />
    </div>
  </div>
</template>

