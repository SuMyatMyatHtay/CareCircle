<script setup>
import '../../../styles/emptyFamilyHomeView.css'
import { ref, computed, onMounted, watch } from 'vue'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import HomeHeader from '../components/HomeHeader.vue'
import SectionCard from '../../../components/common/SectionCard.vue'
import NewTaskButton from '../../tasks/components/NewTaskButton.vue'
import TaskList from '../../tasks/components/TaskList.vue'
import { getFamilyTasks, getTaskErrorMessage } from '../../tasks/services/tasksApi.js'
import TransitBanner from '../components/placeholders/TransitBanner.vue'
import RecipientCard from '../../recipients/components/RecipientCard.vue'
import { useRecipients } from '../../../composables/useRecipients.js'
import RecentUpdates from '../components/placeholders/RecentUpdates.vue'
import LiveUpdateToast from '../components/placeholders/LiveUpdateToast.vue'
import * as placeholder from '../components/placeholders/placeholderData.js'

// Families, selection, loading and errors come from the shared layout state.
// The sidebar and the family loading now live in AppLayout.vue.
const { families, selectedFamilyId, selectedFamily, isLoading, errorMessage, loadFamilies } = useActiveFamily()

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

// ---- Tasks (D): "Today across the family" ----
const tasks = ref([])
const tasksLoading = ref(false)
const tasksError = ref('')

async function loadTasks() {
  const familyId = selectedFamilyId.value
  tasksError.value = ''

  if (!familyId) {
    tasks.value = []
    return
  }

  tasksLoading.value = true
  try {
    const result = await getFamilyTasks(familyId)
    // Ignore the reply if the user switched family while it was loading
    if (familyId === selectedFamilyId.value) tasks.value = result
  } catch (error) {
    if (familyId === selectedFamilyId.value) {
      tasks.value = []
      tasksError.value = getTaskErrorMessage(error)
    }
  } finally {
    if (familyId === selectedFamilyId.value) tasksLoading.value = false
  }
}

onMounted(loadTasks)
// Reload when the user picks another family in the sidebar
watch(selectedFamilyId, loadTasks)

const openTaskCount = computed(() =>
  tasks.value.filter((task) => task.status === 'open').length
)

const todayLabel = new Date().toLocaleDateString('en-SG', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Singapore'
})

const subtitle = computed(() => {
  if (!selectedFamily.value) return 'Care together, closer always ♡'
  if (tasksLoading.value || tasksError.value) return todayLabel

  const count = openTaskCount.value
  return count
    ? `${todayLabel} · ${count} ${count === 1 ? 'task still needs' : 'tasks still need'} someone`
    : `${todayLabel} · every task has someone ♡`
})

// ---- Care recipients (C): loaded by the sidebar, shared through useRecipients ----
const { recipients, isLoading: recipientsLoading, errorMessage: recipientsError, refresh: reloadRecipients } = useRecipients()

function openTasksFor(recipientId) {
  return tasks.value.filter((task) =>
    task.status === 'open' && (task.recipient?._id ?? task.recipient) === recipientId
  ).length
}

// TODO(D): open the task form once it is built
function openNewTask() { }

// ---- Placeholder sections (owners noted in placeholderData.js) ----
// const showToast = ref(true)
</script>

<template>
  <div class="home-page">
    <HomeHeader :title="`${greeting}, ${firstName}`" :subtitle="subtitle">
      <template #actions>
        <NewTaskButton v-if="selectedFamily" @create="openNewTask" />
      </template>
    </HomeHeader>

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
    <div v-else class="family-workspace">
      <!-- Placeholder (E): live transit -->
      <TransitBanner :session="placeholder.transitSession" />

      <!-- C: care recipients (live data) -->
      <h2 class="section-heading">Who are we caring for?</h2>
      <div v-if="recipientsLoading" class="recipient-list-status" role="status">
        <div class="spinner-border spinner-border-sm text-success" aria-hidden="true"></div>
        Loading care recipients...
      </div>
      <div v-else-if="recipientsError" class="recipient-list-status is-error" role="alert">
        <span>{{ recipientsError }}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="reloadRecipients">
          Try again
        </button>
      </div>
      <p v-else-if="recipients.length === 0" class="recipient-list-status">
        No care recipients yet. <RouterLink to="/recipients/new">Add the first one</RouterLink>
      </p>
      <div v-else class="recipient-grid">
        <RecipientCard v-for="recipient in recipients" :key="recipient._id" :recipient="recipient"
          :needs-someone="openTasksFor(recipient._id)" />
      </div>

      <div class="dashboard-columns">
        <!-- D: the family's tasks (live data) -->
        <SectionCard title="Today across the family">
          <TaskList :tasks="tasks" :is-loading="tasksLoading" :error-message="tasksError"
            max-height="60vh" @retry="loadTasks" />
        </SectionCard>

        <!-- Placeholder (F): activity feed -->
        <RecentUpdates :updates="placeholder.recentUpdates" />
      </div>

      <!-- Placeholder (D): live update toast -->
      <LiveUpdateToast v-if="showToast" :avatar="placeholder.liveToast.avatar" :message="placeholder.liveToast.message"
        @close="showToast = false" />
    </div>
  </div>
</template>