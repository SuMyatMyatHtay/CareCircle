<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import SettingsHeader from '../components/SettingsHeader.vue'
import FamilyMembersCard from '../components/FamilyMembersCard.vue'
import InviteCodeCard from '../components/InviteCodeCard.vue'
import LanguagePreferencesCard from '../components/LanguagePreferencesCard.vue'
import AppearanceSettingsCard from '../components/AppearanceSettingsCard.vue'
import TelegramSettingsCard from '../components/TelegramSettingsCard.vue'
import CareModal from '../../../components/common/CareModal.vue'
import FamilyEmptyState from '../../family/components/FamilyEmptyState.vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { useFamilySettings } from '../composables/useFamilySettings.js'
import { useAppearance } from '../composables/useAppearance.js'
import { useSettingsAccountActions } from '../composables/useSettingsAccountActions.js'
import MobileSettingsProfile from '../components/MobileSettingsProfile.vue'
import MobilePreferencesPanel from '../components/MobilePreferencesPanel.vue'
import MobileInviteCodeCard from '../components/MobileInviteCodeCard.vue'
import MobileFamilyMembers from '../components/MobileFamilyMembers.vue'
import MobileLogoutButton from '../components/MobileLogoutButton.vue'
import MobileSettingsNavigation from '../components/MobileSettingsNavigation.vue'
import SettingsProfileEditor from '../components/SettingsProfileEditor.vue'
import MobileSettingsTasksPanel from '../components/MobileSettingsTasksPanel.vue'
import { resetPreview } from '../../family/data/previewFamily.js'
import '../styles/mobileFamilySettings.css'

const {
  selectedFamily,
  selectedFamilyId,
  isAdmin,
  user,
  families,
  isLoading,
  errorMessage,
  loadFamilies,
  isPreview,
  homePath,
  selectFamily,
} = useFamilyWorkspace()
const {
  members,
  membersError,
  loading,
  error,
  busy,
  feedback,
  language,
  loadMembers,
  changeRole,
  deleteMember,
  regenerateCode,
  changeLanguage,
  changeProfile,
  run,
} = useFamilySettings()
const { appearance, theme, setAppearance } = useAppearance()
const { loggingOut, logoutError, logOut } = useSettingsAccountActions()
const mobilePanel = ref(''),
  managedMember = ref(null),
  activeMobileTab = ref('me')
const mobileFamilySection = ref(null),
  mobileAccountSection = ref(null)
const userRole = computed(
  () =>
    selectedFamily.value?.members?.find(
      (member) => member.userId === user.value.id,
    )?.role || (selectedFamily.value ? 'member' : ''),
)
const lastAdmin = computed(
  () =>
    managedMember.value?.role === 'admin' &&
    members.value.filter((member) => member.role === 'admin').length <= 1,
)
const modal = ref(''),
  removingMember = ref(null)
watch(selectedFamilyId, () => {
  modal.value = ''
  removingMember.value = null
  mobilePanel.value = ''
  managedMember.value = null
  activeMobileTab.value = 'me'
})
const code = computed(() => selectedFamily.value?.inviteCode || '')
const defaults = {
  taskPosted: true,
  taskClaimed: true,
  transitMilestone: true,
  careNote: true,
  taskCompleted: false,
  beforeTask: true,
  dailySummary: false,
}
let stored = {}
try {
  stored =
    JSON.parse(
      localStorage.getItem('carecircle:preview:notifications') || '{}',
    ) || {}
} catch {
  /* Use defaults. */
}
const preferences = ref(
  Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [
      key,
      typeof stored[key] === 'boolean' ? stored[key] : value,
    ]),
  ),
)
function changeNotification(key, value) {
  if (!isPreview) return
  preferences.value[key] = value
  try {
    localStorage.setItem(
      'carecircle:preview:notifications',
      JSON.stringify(preferences.value),
    )
  } catch {
    /* Keep the in-memory preference. */
  }
}
async function confirmAction() {
  const succeeded = await run(() =>
    modal.value === 'regenerate'
      ? regenerateCode()
      : deleteMember(removingMember.value),
  )
  if (succeeded) modal.value = ''
}
function askToRemove(member) {
  removingMember.value = member
  modal.value = 'remove'
}
function openMobilePanel(panel) {
  error.value = ''
  mobilePanel.value = panel
}
function manageMobileMember(member) {
  managedMember.value = member
  openMobilePanel('member')
}
async function saveMobileProfile(profile) {
  if (await run(() => changeProfile(profile))) mobilePanel.value = ''
}
function pickFamily(familyId) {
  mobilePanel.value = ''
  selectFamily(familyId)
}
function resetMobilePreview() {
  resetPreview()
  mobilePanel.value = ''
  feedback.value = ''
  error.value = ''
}
async function mobileRemoveMember() {
  const member = managedMember.value
  mobilePanel.value = ''
  await nextTick()
  askToRemove(member)
}
async function mobileChangeRole() {
  const member = managedMember.value
  if (
    await run(() =>
      changeRole(member, member.role === 'admin' ? 'member' : 'admin'),
    )
  )
    mobilePanel.value = ''
}
function navigateMobileSettings(tab) {
  if (tab === 'tasks' || tab === 'calendar') {
    openMobilePanel(tab)
    return
  }
  activeMobileTab.value = tab
  const target =
    tab === 'family' ? mobileFamilySection.value : mobileAccountSection.value
  target?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth',
    block: 'start',
  })
}
function requestMobileLogout() {
  if (isPreview) mobilePanel.value = 'logout'
  else logOut()
}
</script>

<template>
  <div class="care-page care-settings-page">
    <div class="care-settings-desktop">
      <SettingsHeader />
      <FamilyEmptyState
        v-if="isLoading || errorMessage || !families.length"
        :loading="isLoading"
        :error="errorMessage"
        @retry="loadFamilies"
      />
      <template v-else-if="selectedFamily">
        <p v-if="feedback" class="care-feedback" role="status">
          <i class="bi bi-check-circle" aria-hidden="true"></i>
          {{ feedback }}
        </p>
        <p
          v-if="error && members.length"
          class="care-error care-settings-error"
          role="alert"
        >
          {{ error }}
        </p>
        <div class="care-settings-grid">
          <div class="care-settings-column">
            <FamilyMembersCard
              :members="members"
              :user-id="user.id"
              :is-admin="isAdmin"
              :loading="loading"
              :busy="busy"
              :error="membersError || error"
              @retry="loadMembers"
              @invite="modal = 'invite'"
              @change-role="
                (member, role) => run(() => changeRole(member, role))
              "
              @remove="askToRemove"
            />
            <LanguagePreferencesCard
              :language="language"
              :busy="busy"
              @change="(value) => run(() => changeLanguage(value))"
            />
            <AppearanceSettingsCard
              :appearance="appearance"
              @change="setAppearance"
            />
          </div>
          <div class="care-settings-column">
            <InviteCodeCard
              :code="code"
              :is-admin="isAdmin"
              :busy="busy"
              @regenerate="modal = 'regenerate'"
            />
            <TelegramSettingsCard
              :preview="isPreview"
              :preferences="preferences"
              :invite-code="code"
              @change="changeNotification"
            />
          </div>
        </div>
      </template>
    </div>
    <div class="care-settings-mobile">
      <div ref="mobileAccountSection">
        <MobileSettingsProfile
          :user="user"
          :role="userRole"
          :preview="isPreview"
          @edit="openMobilePanel('profile')"
        />
      </div>
      <p
        v-if="feedback"
        class="care-feedback care-mobile-settings-feedback"
        role="status"
      >
        {{ feedback }}
      </p>
      <p
        v-if="error && members.length && !mobilePanel && !modal"
        class="care-error care-settings-error"
        role="alert"
      >
        {{ error }}
      </p>
      <MobilePreferencesPanel
        :appearance="appearance === 'system' ? theme : appearance"
        :language="language"
        :family-name="selectedFamily?.name || 'Your family'"
        :preview="isPreview && Boolean(selectedFamily)"
        :busy="busy"
        @appearance="setAppearance"
        @language="(value) => run(() => changeLanguage(value))"
        @telegram="openMobilePanel('telegram')"
      />
      <FamilyEmptyState
        v-if="isLoading || errorMessage || !families.length"
        :loading="isLoading"
        :error="errorMessage"
        @retry="loadFamilies"
      />
      <section
        v-else-if="selectedFamily"
        ref="mobileFamilySection"
        class="care-mobile-settings-family"
        aria-label="Selected family"
      >
        <header>
          <h2>{{ selectedFamily.name }}</h2>
          <button class="care-text-button" @click="openMobilePanel('switch')">
            Switch
          </button>
        </header>
        <MobileInviteCodeCard
          :code="code"
          :family-name="selectedFamily.name"
          :is-admin="isAdmin"
          :preview="isPreview"
          :busy="busy"
          @regenerate="modal = 'regenerate'"
        />
        <MobileFamilyMembers
          :members="members"
          :user-id="user.id"
          :is-admin="isAdmin"
          :loading="loading"
          :busy="busy"
          :error="membersError || error"
          @retry="loadMembers"
          @manage="manageMobileMember"
        />
      </section>
      <p v-if="logoutError" class="care-error care-small" role="alert">
        {{ logoutError }}
      </p>
      <MobileLogoutButton :busy="loggingOut" @logout="requestMobileLogout" />
      <MobileSettingsNavigation
        :home-path="homePath"
        :active="
          ['tasks', 'calendar'].includes(mobilePanel)
            ? mobilePanel
            : activeMobileTab
        "
        @select="navigateMobileSettings"
      />
    </div>
    <CareModal
      v-if="mobilePanel"
      :title="
        mobilePanel === 'profile'
          ? 'Edit profile'
          : mobilePanel === 'telegram'
            ? 'Telegram updates'
            : mobilePanel === 'switch'
              ? 'Switch family'
              : mobilePanel === 'member'
                ? `Manage ${managedMember?.user.name}`
                : mobilePanel === 'logout'
                  ? 'Leave the preview?'
                  : mobilePanel === 'calendar'
                    ? 'Family calendar'
                    : 'Family tasks'
      "
      @close="mobilePanel = ''"
    >
      <SettingsProfileEditor
        v-if="mobilePanel === 'profile'"
        :user="user"
        :busy="busy"
        :error="error"
        @save="saveMobileProfile"
        @cancel="mobilePanel = ''"
      />
      <TelegramSettingsCard
        v-else-if="mobilePanel === 'telegram'"
        :preview="isPreview"
        :preferences="preferences"
        :invite-code="code"
        @change="changeNotification"
      />
      <div
        v-else-if="mobilePanel === 'switch'"
        class="care-mobile-settings-family-picker"
      >
        <button
          v-for="family in families"
          :key="family.id"
          class="care-mobile-settings-family-option"
          @click="pickFamily(family.id)"
        >
          <span>
            <strong>{{ family.name }}</strong>
            <small>{{ family.members?.length || 0 }} members</small>
          </span>
          <i
            v-if="family.id === selectedFamilyId"
            class="bi bi-check-lg"
            aria-hidden="true"
          ></i>
        </button>
        <p v-if="families.length === 1" class="care-muted care-small mt-3">
          {{
            isPreview
              ? 'This preview contains one sample family.'
              : 'You currently belong to one family.'
          }}
        </p>
        <button
          v-if="isPreview"
          class="care-button"
          @click="resetMobilePreview"
        >
          Reset sample family
        </button>
        <div v-else class="care-actions mt-3">
          <RouterLink to="/create-family" class="care-button">
            Create a family
          </RouterLink>
          <RouterLink to="/join-family" class="care-button">
            Join a family
          </RouterLink>
        </div>
      </div>
      <div
        v-else-if="mobilePanel === 'member'"
        class="care-mobile-member-actions"
      >
        <p class="care-muted care-small">
          {{ managedMember?.relationship || managedMember?.user.email }}
        </p>
        <p v-if="error" class="care-error care-small" role="alert">
          {{ error }}
        </p>
        <button
          v-if="isAdmin"
          class="care-button"
          :disabled="busy || lastAdmin"
          @click="mobileChangeRole"
        >
          {{
            managedMember?.role === 'admin' ? 'Change to member' : 'Make admin'
          }}
        </button>
        <button
          v-if="isAdmin || managedMember?.user._id === user.id"
          class="care-button care-button--danger"
          :disabled="
            busy ||
            lastAdmin ||
            (isPreview && managedMember?.user._id === user.id)
          "
          @click="mobileRemoveMember"
        >
          {{
            managedMember?.user._id === user.id
              ? 'Leave family'
              : 'Remove member'
          }}
        </button>
        <p v-if="lastAdmin" class="care-muted care-small">
          Your family needs at least one admin.
        </p>
        <p
          v-else-if="isPreview && managedMember?.user._id === user.id"
          class="care-muted care-small"
        >
          The sample account stays in this preview family.
        </p>
      </div>
      <div v-else-if="mobilePanel === 'logout'">
        <p class="care-muted care-small">
          Exit these sample screens. Your real account session stays as it is.
        </p>
        <button
          class="care-button care-button--primary"
          :disabled="loggingOut"
          @click="logOut"
        >
          Exit preview
        </button>
      </div>
      <MobileSettingsTasksPanel
        v-else
        :key="mobilePanel"
        :agenda="mobilePanel === 'calendar'"
        :home-path="homePath"
      />
    </CareModal>
    <CareModal
      v-if="modal"
      :title="
        modal === 'invite'
          ? 'Bring your family into the circle'
          : modal === 'regenerate'
            ? 'Create a new invite code?'
            : `Remove ${removingMember?.user.name}?`
      "
      @close="modal = ''"
    >
      <template v-if="modal === 'invite'">
        <p class="care-muted">
          Share the code below. Family members can sign up, then choose “Join a
          family” and enter this code.
        </p>
        <p class="care-invite-code">{{ code }}</p>
        <p v-if="isPreview" class="care-small care-muted">
          This sample code only belongs to the preview.
        </p>
        <button class="care-button care-button--primary" @click="modal = ''">
          Done
        </button>
      </template>
      <template v-else>
        <p class="care-muted">
          {{
            modal === 'regenerate'
              ? 'The current invite code will stop working. Existing members stay in your family.'
              : 'They will lose access to this family’s tasks and care information. They can join again with an invite code.'
          }}
        </p>
        <p v-if="error" class="care-error" role="alert">{{ error }}</p>
        <div class="care-modal-actions">
          <button class="care-button" :disabled="busy" @click="modal = ''">
            Cancel
          </button>
          <button
            class="care-button"
            :class="
              modal === 'remove'
                ? 'care-button--danger'
                : 'care-button--primary'
            "
            :disabled="busy"
            @click="confirmAction"
          >
            {{
              busy
                ? 'Saving…'
                : modal === 'remove'
                  ? 'Remove member'
                  : 'Regenerate code'
            }}
          </button>
        </div>
      </template>
    </CareModal>
  </div>
</template>
