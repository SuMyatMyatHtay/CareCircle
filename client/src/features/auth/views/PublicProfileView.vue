<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getPublicProfile } from '../services/authApi.js'
import CareAvatar from '../../../components/common/CareAvatar.vue'
import AvatarPreview from '../../avatar/components/AvatarPreview.vue'
import { defaultAppearance } from '../../avatar/data/avatarWardrobe.js'
import '../../../styles/profileView.css'

const route = useRoute()
const user = ref(null), loading = ref(false), error = ref('')
const languages = { en: 'English', zh: 'Chinese', ms: 'Malay', ta: 'Tamil' }
const taskStatuses = { claimed: 'Upcoming', in_progress: 'In progress', completed: 'Completed' }
function taskDate(task) {
  const date = task.status === 'completed' ? task.completedAt || task.startAt : task.startAt
  return date ? new Date(date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}
const appearance = computed(() => ({
  baseId: user.value?.avatarAppearance?.baseId || defaultAppearance().baseId,
  equipped: { ...defaultAppearance().equipped, ...user.value?.avatarAppearance?.equipped },
}))
let request = 0
async function loadProfile() {
  const current = ++request
  loading.value = true; user.value = null; error.value = ''
  try {
    const profile = await getPublicProfile(route.params.userId)
    if (current === request) user.value = profile
  } catch (e) {
    if (current === request) error.value = e.response?.data?.message || 'Unable to load profile. Please try again.'
  } finally { if (current === request) loading.value = false }
}
watch(() => route.params.userId, loadProfile, { immediate: true })
</script>

<template>
  <div class="profile-page container-fluid">
    <RouterLink to="/settings" class="profile-back btn mb-3" aria-label="Back to family members" title="Back to family members"><i class="bi bi-arrow-left" aria-hidden="true"></i></RouterLink>
    <p v-if="loading" role="status">Loading profile...</p>
    <div v-else-if="error" class="alert alert-danger" role="alert">
      {{ error }} <button class="btn btn-sm btn-outline-danger ms-2" @click="loadProfile">Try again</button>
    </div>
    <div v-else-if="user" class="row g-4">
      <div class="col-12 col-xl-7">
        <section class="profile-card bg-white rounded-4 p-4">
          <div class="d-flex align-items-center gap-3 mb-4">
            <CareAvatar :person="user" size="profile" />
            <div><h2 class="h4 fw-bold mb-1">{{ user.name }}</h2><span class="profile-pill badge rounded-pill px-3 py-2">CareCircle member</span></div>
          </div>
          <h3 class="h5 fw-bold mb-3">About {{ user.name }}</h3>
          <dl>
            <dt>Preferred language</dt><dd>{{ languages[user.preferredLang] || 'Not specified' }}</dd>
            <dt>Member since</dt><dd>{{ user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not available' }}</dd>
            <template v-if="user.isCaretaker"><dt>Care role</dt><dd>Also a caretaker</dd></template>
          </dl>
        </section>
        <section class="profile-card bg-white rounded-4 p-4 mt-4" aria-labelledby="profile-tasks-title">
          <div class="d-flex align-items-center justify-content-between gap-3 mb-2">
            <h2 id="profile-tasks-title" class="h5 fw-bold mb-0"><i class="bi bi-check2-square me-2 profile-green" aria-hidden="true"></i>Recent care tasks</h2>
            <span class="profile-pill badge rounded-pill">{{ user.tasks?.length || 0 }} recent</span>
          </div>
          <p class="small text-secondary mb-3">A little look at how {{ user.name }} has been helping in your shared families.</p>
          <ul v-if="user.tasks?.length" class="list-unstyled mb-0 profile-task-list">
            <li v-for="task in user.tasks" :key="task._id" class="profile-task d-flex align-items-center gap-3 rounded-4 p-3">
              <span class="profile-task-icon" :class="{ 'is-complete': task.status === 'completed' }"><i :class="task.status === 'completed' ? 'bi bi-check-circle-fill' : 'bi bi-clock'" aria-hidden="true"></i></span>
              <div class="flex-grow-1"><h3 class="h6 fw-bold mb-1">{{ task.title }}</h3><p class="small text-secondary mb-0">{{ taskDate(task) }}</p></div>
              <span class="badge rounded-pill" :class="task.status === 'completed' ? 'text-bg-success' : 'profile-pill'">{{ taskStatuses[task.status] }}</span>
            </li>
          </ul>
          <p v-else class="text-secondary small mb-0 py-3">No ongoing or completed tasks to show yet.</p>
        </section>
      </div>
      <div class="col-12 col-xl-5">
        <section class="profile-card bg-white rounded-4 p-4">
          <h2 class="h4 fw-bold text-center mb-3">{{ user.name }}'s Avatar</h2>
          <div class="pet-display rounded-4 p-3 text-center"><AvatarPreview :appearance="appearance" /></div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-back { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: var(--theme-soft, #e8f5e9); color: var(--theme-green, #2e7d43); font-size: 1.25rem; }
.profile-back:hover { background: var(--theme-border, #d8e8db); }
.profile-task-list { display: grid; gap: 12px; }
.profile-task { background: var(--theme-page, #f7faf7); flex-wrap: wrap; }
.profile-task h3 { overflow-wrap: anywhere; }
.profile-task-icon { color: #987018; font-size: 1.4rem; }
.profile-task-icon.is-complete { color: var(--theme-green, #2e7d43); }
</style>
