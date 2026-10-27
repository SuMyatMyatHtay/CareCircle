<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import HomeHeader from '../components/HomeHeader.vue'
import NewTaskButton from '../../tasks/components/NewTaskButton.vue'
import FamilyEmptyState from '../components/FamilyEmptyState.vue'
import TransitBanner from '../components/TransitBanner.vue'
import RecipientOverview from '../components/RecipientOverview.vue'
import TodayTasks from '../components/TodayTasks.vue'
import RecentUpdates from '../components/RecentUpdates.vue'
import LiveUpdateToast from '../components/LiveUpdateToast.vue'
import NewTaskModal from '../../tasks/components/NewTaskModal.vue'
import CareModal from '../../../components/common/CareModal.vue'
import { useFamilyWorkspace } from '../composables/useFamilyWorkspace.js'
import { useFamilyDashboard } from '../composables/useFamilyDashboard.js'
import { previewState } from '../data/previewFamily.js'
import MobileHomeHeader from '../components/MobileHomeHeader.vue'
import MobileTransitCard from '../components/MobileTransitCard.vue'
import MobileTodayTasks from '../components/MobileTodayTasks.vue'
import MobileHomeNavigation from '../components/MobileHomeNavigation.vue'
import CareAvatar from '../../../components/common/CareAvatar.vue'
import '../styles/mobileFamilyHome.css'
import { useActiveTransit } from '../../transit/utils/useActiveTransit.js' // E: live trip banner

const router = useRouter()
const {
  user,
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
  tasks,
  todayTasks,
  activity,
  loading,
  error,
  busyId,
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
const upcomingTasks = computed(() =>
  [...tasks.value].sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
)
async function openMobileTaskForm() {
  mobilePanel.value = ''
  await nextTick()
  if (isPreview) openNewTask()
  else router.push({ name: 'task-new' })
}
function navigateMobileHome(tab) {
  if (tab === 'tasks' && !isPreview) {
    router.push({ name: 'my-tasks' })
    return
  }
  mobilePanel.value = tab === 'home' ? '' : tab
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
const displayTasks = computed(() =>
  filterRecipient.value
    ? tasks.value
        .filter(
          (task) =>
            (task.recipient?._id || task.recipient) ===
              filterRecipient.value._id && task.status === 'open',
        )
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
    : todayTasks.value,
)
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
          @show-open-tasks="filterRecipient = $event"
        />
        <div class="care-dashboard-grid">
          <TodayTasks
            :tasks="displayTasks"
            :loading="loading"
            :error="error"
            :busy-id="busyId"
            :filter-label="
              filterRecipient?.nickname || filterRecipient?.name || ''
            "
            @retry="loadTasks()"
            @claim="claimTask"
            @clear-filter="filterRecipient = null"
          />
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
          @see-all="mobilePanel = 'tasks'"
          @retry="loadTasks()"
          @claim="claimTask"
        />
      </template>
      <MobileHomeNavigation
        :contributions-enabled="Boolean(selectedFamily)"
        :preview="isPreview"
        :home-path="homePath"
        :settings-path="settingsPath"
        :active="mobilePanel || 'home'"
        @select="navigateMobileHome"
      />
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
      <MobileTodayTasks
        v-if="mobilePanel === 'tasks'"
        :tasks="upcomingTasks"
        :loading="loading"
        :error="error"
        :busy-id="busyId"
        title="Upcoming tasks"
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
        <h3>Care recipients</h3>
        <p
          v-if="recipientsLoading || recipientsError || !recipients.length"
          class="care-muted care-small"
        >
          {{
            recipientsLoading
              ? 'Loading care recipients…'
              : recipientsError || 'No care recipients yet.'
          }}
        </p>
        <button
          v-for="recipient in recipients"
          :key="recipient._id || recipient.id"
          class="care-mobile-person"
          @click="openMobileRecipient(recipient)"
        >
          <CareAvatar :person="recipient" size="small" />
          <span>{{ recipient.nickname || recipient.name }}</span>
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
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
