
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import FamilySidebar from '../components/FamilySidebar.vue'
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

<style scoped>
.home-layout {
  display: flex;
  min-height: 100vh;
  background: #FCFBF8;
  color: #2F2F2F;
  font-family: 'Nunito', system-ui, sans-serif;
}

.home-main {
  flex: 1;
  min-width: 0;
  padding: 29px 32px;
}

.main-header h1 {
  font-size: 31px;
  font-weight: 900;
  margin-bottom: 3px;
}

.main-header p {
  color: #7B8391;
  font-size: 15px;
}

.status-screen {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 15px;
  color: #7D887E;
}

.empty-state {
  max-width: 650px;
  margin: 75px auto 0;
  padding: 45px 25px;
  text-align: center;
  background: white;
  border: 1px solid #E4ECE5;
  border-radius: 25px;
  box-shadow: 0 12px 32px #476F5010;
}

.empty-illustration {
  font-size: 75px;
  margin-bottom: 25px;
}

.small-tag {
  display: inline-block;
  padding: 8px 18px;
  background: #E8F5E9;
  color: #52966C;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 1.1px;
}

.empty-state h2 {
  font-weight: 900;
  margin: 20px 0 12px;
  font-size: 28px;
}

.empty-state p {
  color: #7D847F;
  max-width: 465px;
  line-height: 1.8;
  margin: auto;
}

.empty-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 13px;
  margin-top: 30px;
}

.primary-action,
.secondary-action {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 13px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
  border: 1px solid transparent;
  cursor: pointer;
}

.primary-action {
  background: #2E7D43;
  color: white;
}

.primary-action:hover {
  background: #256836;
  color: white;
}

.secondary-action {
  background: #FFF0EB;
  color: #B66C61;
  border-color: #FFDAD0;
}

.secondary-action:hover {
  background: #FFE4DB;
  color: #A95D52;
}

.bottom-message {
  margin-top: 35px;
  font-size: 13px;
  color: #91A095;
}

.family-workspace {
  min-height: 65vh;
}

@media (max-width: 767px) {
  .home-layout {
    flex-direction: column;
  }

  .home-main {
    padding: 25px 18px;
  }

  .main-header h1 {
    font-size: 25px;
  }

  .empty-state {
    margin: 35px auto 0;
    padding: 35px 20px;
  }

  .empty-illustration {
    font-size: 55px;
  }
}
</style>
