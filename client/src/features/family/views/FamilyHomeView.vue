<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import HomeHeader from '../components/HomeHeader.vue'
import NewTaskButton from '../../tasks/components/NewTaskButton.vue'
import FamilyEmptyState from '../components/FamilyEmptyState.vue'
import TransitBanner from '../components/TransitBanner.vue'
import RecipientOverview from '../components/RecipientOverview.vue'
import DeleteOverdueTasks from '../../tasks/components/DeleteOverdueTasks.vue'
import TodayTasks from '../components/TodayTasks.vue'
import UrgentUpcomingTasks from '../components/UrgentUpcomingTasks.vue'
import RecentUpdates from '../components/RecentUpdates.vue'
import LiveUpdateToast from '../components/LiveUpdateToast.vue'
import NewTaskModal from '../../tasks/components/NewTaskModal.vue'
import CareModal from '../../../components/common/CareModal.vue'
import { useFamilyWorkspace } from '../composables/useFamilyWorkspace.js'
import { useFamilyDashboard, singaporeDay } from '../composables/useFamilyDashboard.js'
import { isTaskOverdue, useTaskClock } from '../../tasks/composables/useTaskOverdue.js'
import { groupRecurringTasks } from '../../tasks/composables/groupRecurringTasks.js'
import { previewState } from '../data/previewFamily.js'
import MobileHomeHeader from '../components/MobileHomeHeader.vue'
import MobileTransitCard from '../components/MobileTransitCard.vue'
import MobileTodayTasks from '../components/MobileTodayTasks.vue'
import '../styles/mobileFamilyHome.css'
import { useActiveTransit } from '../../transit/utils/useActiveTransit.js' // E: live trip banner

const router = useRouter()
const {
  user,
  isAdmin,
  selectedFamily,
  selectedFamilyId,
  families,
  isLoading,
  errorMessage,
  loadFamilies,
  recipients,
  recipientsLoading,
  recipientsError,
  loadRecipients,
  isPreview,
  homePath,
  settingsPath,
  selectFamily,
} = useFamilyWorkspace()
const {
  allTasks,
  tasks,
  todayTasks,
  activity,
  loading,
  error,
  busyId,
  claimedId,
  flashIds,
  toast,
  toastError,
  openTaskCount,
  loadTasks,
  claimTask,
  createTask,
  onTaskCreated,
} = useFamilyDashboard()
// E (Chaithra): the family's live trip for the banner; preview mode keeps its sample
// One banner per live trip (several people can be travelling at once)
const { liveTransits, openLiveTransit } = useActiveTransit(selectedFamilyId, { enabled: !isPreview })
const allTransitBanners = computed(() => (isPreview ? [previewState.transit].filter(Boolean) : liveTransits.value))
// Newest trip only, the rest behind "+N more on a trip" so Home never fills up with banners
const showAllTrips = ref(false)
const transitBanners = computed(() => (showAllTrips.value ? allTransitBanners.value : allTransitBanners.value.slice(0, 1)))
const moreTrips = computed(() => Math.max(0, allTransitBanners.value.length - 1))
const moreTripsLabel = computed(() =>
  showAllTrips.value
    ? 'Show less'
    : `+${moreTrips.value} more ${moreTrips.value === 1 ? 'person' : 'people'} on a trip`,
)
function viewTransit(banner) {
  if (isPreview) showTransit.value = true
  else openLiveTransit(banner)
}
const firstName = computed(() => user.value.name?.split(/\s+/)[0] || 'friend')
const greeting = computed(() => {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Asia/Singapore',
    }).format(new Date()),
  )
  return hour < 12
    ? 'Good morning'
    : hour < 18
      ? 'Good afternoon'
      : 'Good evening'
})
const todayLabel = new Intl.DateTimeFormat('en-SG', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Singapore',
}).format(new Date())
const mobileDate = new Intl.DateTimeFormat('en-SG', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Singapore',
}).format(new Date())
const mobilePanel = ref('')
// Start on what's coming up (not just today), so a task posted for tomorrow is right there to
// claim, and stays in view as "Claimed" after you take it
const taskFilter = ref('upcoming')
const taskNow = useTaskClock()
const urgentUpcomingTasks = computed(() => withDeletionPermissions(groupRecurringTasks(
  allTasks.value.filter(task => task.status === 'open' && !task.claimedBy && !isTaskOverdue(task, taskNow.value)),
  taskNow.value,
)).slice(0, 3))
const selectedOverdueIds = ref([])
const deletingOverdue = ref(false)
const canSelectOverdue = computed(() => taskFilter.value === 'overdue')
const overdueTaskIds = computed(() => displayTasks.value.filter(task => task.deletionAllowed && task.status === 'open' && isTaskOverdue(task, taskNow.value)).map(task => task._id))
function toggleOverdue(id, checked) {
  if (!canSelectOverdue.value || deletingOverdue.value || !overdueTaskIds.value.includes(id)) return
  selectedOverdueIds.value = checked ? [...new Set([...selectedOverdueIds.value, id])] : selectedOverdueIds.value.filter(value => value !== id)
}
function selectAllOverdue(checked) {
  if (!canSelectOverdue.value || deletingOverdue.value) return
  selectedOverdueIds.value = checked ? [...overdueTaskIds.value] : []
}
async function afterOverdueDeleted() {
  selectedOverdueIds.value = []
  await loadTasks()
}
watch([selectedFamilyId, taskFilter, canSelectOverdue], () => { selectedOverdueIds.value = [] })
const taskFilters = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'open', label: 'Needs someone' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'claimed', label: 'Claimed' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All tasks' },
]
const taskBoardTasks = computed(() => taskFilter.value === 'today' ? todayTasks.value
  : allTasks.value.filter(task => {
      // In progress whatever the date; claimed from today on; open while it can still be claimed
      if (taskFilter.value === 'upcoming') return task.status === 'in_progress' ||
        (task.status === 'claimed' && +new Date(task.startAt) >= +new Date(`${singaporeDay(taskNow.value)}T00:00:00+08:00`)) ||
        (task.status === 'open' && !isTaskOverdue(task, taskNow.value))
      if (taskFilter.value === 'open') return task.status === 'open' && !isTaskOverdue(task, taskNow.value)
      if (taskFilter.value === 'overdue') return task.status === 'open' && isTaskOverdue(task, taskNow.value)
      return taskFilter.value === 'all' || task.status === taskFilter.value
    }))
const upcomingTasks = computed(() =>
  [...displayTasks.value].sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
)
function showRecipientTasks(recipient) {
  filterRecipient.value = recipient
  taskFilter.value = 'open'
}
function showMobileRecipientTasks(recipient) {
  showRecipientTasks(recipient)
  mobilePanel.value = 'tasks'
}
async function openMobileTaskForm() {
  mobilePanel.value = ''
  await nextTick()
  if (isPreview) openNewTask()
  else router.push({ name: 'task-new' })
}
function showAllMobileTasks() {
  taskFilter.value = 'all'
  mobilePanel.value = 'tasks'
}
function switchMobileFamily(familyId) {
  mobilePanel.value = ''
  selectFamily(familyId)
}
async function openMobileRecipient(recipient) {
  mobilePanel.value = ''
  await nextTick()
  openRecipient(recipient)
}
const subtitle = computed(() =>
  !selectedFamily.value || loading.value || error.value
    ? todayLabel
    : `${todayLabel} · ${openTaskCount.value ? `${openTaskCount.value} ${openTaskCount.value === 1 ? 'task still needs' : 'tasks still need'} someone` : 'every task has someone'}`,
)
const filterRecipient = ref(null),
  showNewTask = ref(false),
  showTransit = ref(false)
function withDeletionPermissions(rows) {
  return rows.map(task => ({ ...task, deletionAllowed: isAdmin.value || String(task.createdBy?._id || task.createdBy) === user.value.id }))
}
const displayTasks = computed(() =>
  withDeletionPermissions(groupRecurringTasks(filterRecipient.value
    ? taskBoardTasks.value
        .filter(
          (task) =>
            (task.recipient?._id || task.recipient) ===
              filterRecipient.value._id,
        )
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
    : taskBoardTasks.value, taskNow.value)),
)
watch(overdueTaskIds, ids => { selectedOverdueIds.value = selectedOverdueIds.value.filter(id => ids.includes(id)) })
function openRecipient(recipient) {
  if (!isPreview) {
    router.push({ name: 'recipient-overview', params: { recipientId: recipient._id } })
    return
  }
  window.dispatchEvent(
    new CustomEvent('carecircle:open-recipient', { detail: recipient }),
  )
}
function openNewTask() {
  showNewTask.value = true
}
// The preview has no API: the real New task form posts into the sample data instead
const savePreviewTask = isPreview
  ? async (input) => {
      await createTask(input)
      return input
    }
  : null
watch(selectedFamilyId, () => {
  taskFilter.value = 'today'
  mobilePanel.value = ''
  filterRecipient.value = null
  showNewTask.value = false
  showTransit.value = false
})
</script>

<template>
  <div class="care-page care-home-page">
    <div class="care-home-desktop">
      <HomeHeader :title="`${greeting}, ${firstName}`" :subtitle="subtitle">
        <template #actions>
          <NewTaskButton
            v-if="selectedFamily"
            :key="selectedFamilyId"
            :save="savePreviewTask"
            @created="onTaskCreated"
          />
        </template>
      </HomeHeader>
      <FamilyEmptyState
        v-if="isLoading || errorMessage || !families.length"
        :loading="isLoading"
        :error="errorMessage"
        @retry="loadFamilies"
      />
      <template v-else-if="selectedFamily">
        <TransitBanner
          v-for="(banner, i) in transitBanners"
          :key="banner.taskId || i"
          :session="banner"
          :style="i < transitBanners.length - 1 || moreTrips ? { marginBottom: '10px' } : null"
          @view="viewTransit(banner)"
        />
        <button
          v-if="moreTrips"
          type="button"
          class="care-more-trips"
          :aria-expanded="showAllTrips"
          @click="showAllTrips = !showAllTrips"
        >
          {{ moreTripsLabel }}
          <i class="bi" :class="showAllTrips ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
        </button>
        <RecipientOverview
          :recipients="recipients"
          :loading="recipientsLoading"
          :error="recipientsError"
          :tasks="tasks"
          :tasks-available="!error && !loading"
          :preview="isPreview"
          @retry="loadRecipients"
          @open="openRecipient"
          @show-open-tasks="showRecipientTasks"
        />
        <UrgentUpcomingTasks :tasks="urgentUpcomingTasks" :loading="loading" :error="error" :busy-id="busyId" @claim="claimTask" @retry="loadTasks()" />
        <div class="care-dashboard-grid">
          <TodayTasks
            :selectable="canSelectOverdue"
            :selected-ids="selectedOverdueIds"
            :selection-busy="deletingOverdue"
            @select-task="toggleOverdue"
            :filter="taskFilter"
            :filters="taskFilters"
            :tasks="displayTasks"
            :loading="loading"
            :error="error"
            :busy-id="busyId"
            :claimed-id="claimedId"
            :flash-ids="flashIds"
            :filter-label="
              filterRecipient?.nickname || filterRecipient?.name || ''
            "
            @retry="loadTasks()"
            @claim="claimTask"
            @clear-filter="filterRecipient = null"
            @filter="taskFilter = $event; filterRecipient = null"
          >
            <template #bulk-actions>
              <DeleteOverdueTasks v-if="taskFilter === 'overdue'" :selected-ids="selectedOverdueIds" :task-ids="overdueTaskIds" :disabled="loading || Boolean(error)" @select-all="selectAllOverdue" @busy="deletingOverdue = $event" @deleted="afterOverdueDeleted" />
            </template>
          </TodayTasks>
          <RecentUpdates :updates="activity" :preview="isPreview" />
        </div>
      </template>
    </div>
    <div class="care-home-mobile">
      <MobileHomeHeader
        :family-name="selectedFamily?.name || 'Your family'"
        :date="mobileDate"
        :greeting="`${greeting}, ${firstName}`"
        :user="user"
        :settings-path="settingsPath"
        :can-switch-family="families.length > 1"
        :preview="isPreview"
        @switch-family="mobilePanel = 'families'"
      />
      <FamilyEmptyState
        v-if="isLoading || errorMessage || !families.length"
        :loading="isLoading"
        :error="errorMessage"
        @retry="loadFamilies"
      />
      <template v-else-if="selectedFamily">
        <div class="care-mobile-home-actions" aria-label="Family home actions">
          <NewTaskButton
            :key="selectedFamilyId"
            :save="savePreviewTask"
            @created="onTaskCreated"
          />
          <button type="button" class="care-button" @click="mobilePanel = 'people'">
            <i class="bi bi-people" aria-hidden="true"></i>
            Care recipients
          </button>
        </div>
        <MobileTransitCard
          v-for="(banner, i) in transitBanners"
          :key="banner.taskId || i"
          :session="banner"
          :style="i < transitBanners.length - 1 || moreTrips ? { marginBottom: '10px' } : null"
          @view="viewTransit(banner)"
        />
        <button
          v-if="moreTrips"
          type="button"
          class="care-more-trips"
          :aria-expanded="showAllTrips"
          @click="showAllTrips = !showAllTrips"
        >
          {{ moreTripsLabel }}
          <i class="bi" :class="showAllTrips ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
        </button>
        <MobileTodayTasks
          :tasks="todayTasks"
          :loading="loading"
          :error="error"
          :busy-id="busyId"
          @see-all="showAllMobileTasks"
          @retry="loadTasks()"
          @claim="claimTask"
        />
        <MobileTodayTasks :tasks="urgentUpcomingTasks" title="Upcoming tasks needing someone" :show-all="false" show-date :loading="loading" :error="error" :busy-id="busyId" @claim="claimTask" @retry="loadTasks()" />
        <!-- Phones use the left menu (☰) only, so Recent updates sits on the page
             instead of behind a bottom-bar "Activity" tab -->
        <RecentUpdates class="care-mobile-recent" :updates="activity" :preview="isPreview" />
      </template>
    </div>
    <CareModal
      v-if="mobilePanel"
      :title="
        mobilePanel === 'tasks'
          ? 'Family tasks'
          : mobilePanel === 'people'
            ? 'Your family circle'
            : mobilePanel === 'families'
              ? 'Choose a family'
              : 'Family activity'
      "
      @close="mobilePanel = ''"
    >
      <div v-if="mobilePanel === 'tasks'" class="care-home-task-filters" role="group" aria-label="Filter family tasks">
        <button v-for="option in taskFilters" :key="option.key" type="button" :aria-pressed="taskFilter === option.key" :class="{ selected: taskFilter === option.key }" @click="taskFilter = option.key; filterRecipient = null">{{ option.label }}</button>
      </div>
      <div v-if="mobilePanel === 'tasks' && filterRecipient" class="care-task-filter">
        Unclaimed · {{ filterRecipient.nickname || filterRecipient.name }}
        <button type="button" class="care-text-button" @click="filterRecipient = null">Clear</button>
      </div>
      <DeleteOverdueTasks v-if="mobilePanel === 'tasks' && taskFilter === 'overdue'" :selected-ids="selectedOverdueIds" :task-ids="overdueTaskIds" :disabled="loading || Boolean(error)" @select-all="selectAllOverdue" @busy="deletingOverdue = $event" @deleted="afterOverdueDeleted" />
      <MobileTodayTasks
        v-if="mobilePanel === 'tasks'"
        :tasks="upcomingTasks"
        :selectable="canSelectOverdue"
        :selected-ids="selectedOverdueIds"
        :selection-busy="deletingOverdue"
        @select-task="toggleOverdue"
        :loading="loading"
        :error="error"
        :busy-id="busyId"
        title="Family tasks"
        :show-all="false"
        show-date
        :allow-create="Boolean(selectedFamily)"
        @retry="loadTasks()"
        @claim="claimTask"
        @create="openMobileTaskForm"
      />
      <div
        v-else-if="mobilePanel === 'people'"
        class="care-mobile-people-panel"
      >
        <p class="care-muted care-small">
          {{ selectedFamily?.name || 'Your family' }} ·
          {{ selectedFamily?.members?.length || 0 }} members
        </p>
        <RouterLink :to="settingsPath" class="care-button">
          View family members
        </RouterLink>
        <RouterLink v-if="!isPreview && recipients.length" to="/recipients/new" class="care-button">
          <i class="bi bi-plus-lg" aria-hidden="true"></i> Add care recipient
        </RouterLink>
        <RecipientOverview
          :recipients="recipients"
          :loading="recipientsLoading"
          :error="recipientsError"
          :tasks="allTasks"
          :tasks-available="!error && !loading"
          :preview="isPreview"
          @retry="loadRecipients"
          @open="openMobileRecipient"
          @show-open-tasks="showMobileRecipientTasks"
        />
      </div>
      <div
        v-else-if="mobilePanel === 'families'"
        class="care-mobile-family-options"
      >
        <button
          v-for="family in families"
          :key="family.id"
          class="care-mobile-person"
          @click="switchMobileFamily(family.id)"
        >
          <span>{{ family.name }}</span>
          <i
            v-if="family.id === selectedFamilyId"
            class="bi bi-check-lg"
            aria-hidden="true"
          ></i>
        </button>
      </div>
      <RecentUpdates v-else :updates="activity" :preview="isPreview" />
    </CareModal>
    <NewTaskModal
      v-if="showNewTask"
      :save="savePreviewTask"
      @close="showNewTask = false"
    />
    <CareModal
      v-if="showTransit"
      title="Grandpa’s journey"
      @close="showTransit = false"
    >
      <p class="care-muted care-small">Sample timeline · TTSH Eye Centre</p>
      <ol class="care-transit-timeline">
        <li class="done">
          <strong>Departed home</strong>
          <time>9:30am · Jasmine</time>
        </li>
        <li class="done">
          <strong>Arrived at clinic</strong>
          <time>10:12am · Jasmine</time>
        </li>
        <li>Consultation done</li>
        <li>Heading home</li>
        <li>Safely back home</li>
      </ol>
    </CareModal>
    <LiveUpdateToast
      :message="toast"
      :error="toastError"
      :detail="
        isPreview
          ? 'Preview saved on this device.'
          : 'The family board has been updated.'
      "
      @close="toast = ''"
    />
  </div>
</template>

<style>
/* E (Chaithra): "+N more on a trip" under the live transit banner */
.care-more-trips {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 22px;
  padding: 6px 12px;
  border: 1px solid var(--theme-accent-border, #cfe8d3);
  border-radius: 999px;
  background: var(--theme-panel, #fff);
  color: var(--theme-green, #2f7a3f);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.care-more-trips:hover {
  background: var(--theme-soft, #e8f5e9);
}
</style>
