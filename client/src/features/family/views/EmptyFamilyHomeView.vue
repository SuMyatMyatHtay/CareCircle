
<script setup>
import '../../../styles/emptyFamilyHomeView.css'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import FamilySidebar from '../../../components/layout/FamilySidebar.vue'
import {
  getMyFamilies,
  getFamilyErrorMessage
} from '../services/familyApi.js'

const router = useRouter()

const families = ref([])
const selectedFamilyId = ref('')
const isLoading = ref(true)
const errorMessage = ref('')

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

const selectedFamily = computed(() =>
  families.value.find(f => f.id === selectedFamilyId.value)
)

const greeting = computed(() => {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})

// Retrieve the user's real families from MongoDB
async function loadFamilies() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await getMyFamilies()

    if (!Array.isArray(result)) {
      throw new Error('Invalid family data from server.')
    }

    families.value = result

    // Preserve selection if the family still belongs to user
    const savedFamilyId = sessionStorage.getItem('activeFamilyId')

    const existingFamily = result.find(
      family => family.id === savedFamilyId
    )

    selectedFamilyId.value =
      existingFamily?.id || result[0]?.id || ''

    if (selectedFamilyId.value) {
      sessionStorage.setItem(
        'activeFamilyId',
        selectedFamilyId.value
      )
    } else {
      sessionStorage.removeItem('activeFamilyId')
    }

  } catch (error) {
    errorMessage.value = getFamilyErrorMessage(error)
    families.value = []
    selectedFamilyId.value = ''

  } finally {
    isLoading.value = false
  }
}

function handleSelectFamily(familyId) {
  if (!families.value.some(f => f.id === familyId)) return

  selectedFamilyId.value = familyId
  sessionStorage.setItem('activeFamilyId', familyId)
}

onMounted(() => {
  if (!sessionStorage.getItem('token')) {
    router.replace('/login')
    return
  }

  loadFamilies()
})
</script>

<template>
  <div class="home-layout">
    <!-- LEFT SIDEBAR -->
    <FamilySidebar
      :families="families"
      :selected-family-id="selectedFamilyId"
      :user="user"
      @select-family="handleSelectFamily"
    />

    <!-- RIGHT MAIN CONTENT -->
    <main class="home-main">
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
    </main>
  </div>
</template>
