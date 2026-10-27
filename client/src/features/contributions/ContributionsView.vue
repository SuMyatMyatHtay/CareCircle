<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useFamilyWorkspace } from '../family/composables/useFamilyWorkspace.js'
import { useFamilyTasks } from '../../composables/useFamilyTasks.js'
import { getMembers } from '../settings/services/settingsApi.js'
import { analyzeContributions } from './analytics.js'
import CareAvatar from '../../components/common/CareAvatar.vue'
import FamilyEmptyState from '../family/components/FamilyEmptyState.vue'
import './contributions.css'

const { selectedFamily, selectedFamilyId, families, selectFamily, user, isLoading, errorMessage, loadFamilies } = useFamilyWorkspace()
const { tasks, isLoading: tasksLoading, errorMessage: tasksError, refetch } = useFamilyTasks()
const memberQuery = useQuery({
  queryKey: computed(() => ['contribution-members', selectedFamilyId.value]),
  queryFn: ({ queryKey }) => getMembers(queryKey[1]),
  enabled: computed(() => Boolean(selectedFamilyId.value)),
})
const period = ref('month'), showHistory = ref(false), now = ref(new Date())
const periods = [{ key: 'week', label: 'This week' }, { key: 'month', label: 'This month' }, { key: 'all', label: 'All time' }]
const stats = computed(() => analyzeContributions(tasks.value, memberQuery.data.value || [], selectedFamilyId.value, period.value, now.value))
const podium = computed(() => stats.value.rows.filter(row => row.count > 0).slice(0, 3))
const me = computed(() => stats.value.rows.find(row => row.id === user.value.id))
const highlights = computed(() => stats.value.rows.filter(row => row.streak > 0 || row.badges.length).slice(0, 4))
const busy = computed(() => tasksLoading.value || memberQuery.isLoading.value)
const error = computed(() => tasksError.value || (memberQuery.isError.value ? 'Unable to load family members. Please try again.' : ''))
const dateLabel = date => new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore' }).format(new Date(date))
function refresh() { now.value = new Date(); refetch(); memberQuery.refetch() }
function onVisible() { if (document.visibilityState === 'visible' && selectedFamilyId.value) refresh() }
watch(selectedFamilyId, () => { showHistory.value = false; now.value = new Date() })
watch(period, () => { showHistory.value = false; now.value = new Date() })
let timer
onMounted(() => { document.addEventListener('visibilitychange', onVisible); window.addEventListener('carecircle:task-updated', refresh); timer = setInterval(() => { now.value = new Date() }, 60000) })
onUnmounted(() => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('carecircle:task-updated', refresh); clearInterval(timer) })
</script>

<template>
  <div class="contributions-page">
    <header class="contributions-header">
      <div><div class="contributions-eyebrow">{{ selectedFamily?.name || 'Your family' }}</div><h1>Contributions</h1><p>Every helping hand makes a difference. Celebrate the care you give together.</p></div>
      <label v-if="families.length > 1" class="contributions-family"><span>Family</span><select :value="selectedFamilyId" @change="selectFamily($event.target.value)"><option v-for="family in families" :key="family.id" :value="family.id">{{ family.name }}</option></select></label>
    </header>
    <FamilyEmptyState v-if="isLoading || errorMessage || !selectedFamily" :loading="isLoading" :error="errorMessage" @retry="loadFamilies" />
    <template v-else>
      <div class="contributions-toolbar"><span>Rankings belong to this family only</span><div class="contributions-periods" role="group" aria-label="Contribution period"><button v-for="item in periods" :key="item.key" :aria-pressed="period === item.key" :class="{ selected: period === item.key }" @click="period = item.key">{{ item.label }}</button></div></div>
      <p v-if="busy" role="status" class="contributions-card">Loading contributions…</p>
      <div v-else-if="error" role="alert" class="contributions-card"><p>{{ error }}</p><button class="care-button" @click="refresh">Try again</button></div>
      <template v-else>
        <div class="contributions-summary"><div><strong>{{ stats.total }}</strong><span>Tasks completed</span></div><div><strong>{{ stats.helpers }}</strong><span>Helping hands</span></div><div><strong>{{ stats.points }}</strong><span>Care points earned</span></div></div>
        <div class="contributions-grid">
          <div class="contributions-main">
            <section class="contributions-card contributions-podium" aria-label="Top contributors">
              <template v-if="podium.length"><div v-for="(row, index) in podium" :key="row.id" class="contributions-winner" :class="`place-${index + 1}`"><i v-if="index === 0" class="bi bi-crown contributions-crown" aria-hidden="true">♕</i><CareAvatar :person="row.person" /><strong>{{ row.person.name }}</strong><small>{{ row.count }} tasks · {{ row.points }} pts</small><div class="contributions-step">{{ row.rank }}</div></div></template>
              <div v-else class="contributions-empty"><i class="bi bi-trophy" aria-hidden="true"></i><h2>Your next helping hand starts here</h2><p>No completed tasks in this period yet. Complete a family task to earn your first care point.</p><RouterLink to="/home" class="care-button">Find a task to help with</RouterLink></div>
            </section>
            <section class="contributions-card"><h2>Family leaderboard</h2><p class="contributions-muted">Equal points and task totals share a rank. Every contribution counts.</p><ol class="contributions-ranking"><li v-for="row in stats.rows" :key="row.id"><span class="contributions-rank">{{ row.count ? row.rank : '—' }}</span><CareAvatar :person="row.person" /><div class="contributions-person"><strong>{{ row.person.name }} <small v-if="row.id === user.id">(you)</small></strong><small v-if="row.streak">{{ row.streak }}-day streak</small><div class="contributions-bar"><span :style="{ width: `${stats.points ? row.points / Math.max(1, stats.rows[0]?.points) * 100 : 0}%` }"></span></div></div><div class="contributions-score"><strong>{{ row.count }} tasks</strong><small>{{ row.points }} pts · {{ row.share }}% of tasks</small></div></li></ol><p class="contributions-muted contributions-rules">Points: 1 per completed task, +1 for an appointment with transit, +1 if claimed within an hour of creation. Periods use completion dates in Singapore time; weeks start Monday.</p></section>
          </div>
          <aside class="contributions-side">
            <section class="contributions-card"><h2>Streaks &amp; badges</h2><p class="contributions-muted">Streaks count consecutive helping days through today or yesterday, across all time. Badges use the selected period.</p><div v-for="row in highlights" :key="row.id" class="contributions-highlight"><CareAvatar :person="row.person" size="small" /><div><strong>{{ row.person.name }}</strong><p v-if="row.streak">🔥 {{ row.streak }} {{ row.streak === 1 ? 'day' : 'days' }} of helping</p><p v-for="badge in row.badges" :key="badge">🏅 {{ badge }}</p></div></div><p v-if="!highlights.length" class="contributions-muted">Complete a task to start a helping streak.</p><div v-if="me" class="contributions-next"><strong>Your next badge: Night owl</strong><p>Complete 5 tasks after 6pm in the selected period.</p><progress :value="Math.min(me.evenings, 5)" max="5" :aria-label="`${Math.min(me.evenings, 5)} of 5 evening tasks`"></progress><small>{{ Math.min(me.evenings, 5) }} of 5 {{ me.evenings >= 5 ? '· Earned!' : '' }}</small></div><details class="contributions-muted"><summary>How to earn badges</summary><p>Appointment hero: complete 3 appointments. Quick to help: complete 3 tasks claimed within an hour of creation. Night owl: complete 5 tasks after 6pm, Singapore time.</p></details></section>
            <section class="contributions-card"><div class="contributions-section-heading"><h2>Recent completions</h2><button v-if="stats.recent.length > 4" @click="showHistory = !showHistory">{{ showHistory ? 'Show less' : 'See all history' }}</button></div><p v-if="!stats.recent.length" class="contributions-muted">Your family's completed tasks will appear here.</p><RouterLink v-for="task in (showHistory ? stats.recent : stats.recent.slice(0, 4))" :key="task._id" class="contributions-completion" :to="{ name: 'task-detail', params: { familyId: selectedFamilyId, taskId: task._id } }"><CareAvatar :person="typeof task.claimedBy === 'object' ? task.claimedBy : {}" size="small" /><div><strong>{{ task.claimedBy?.name || 'Former member' }}</strong><span>{{ task.title }}</span><small>{{ dateLabel(task.completedAt) }} · {{ task.category }}</small></div></RouterLink></section>
          </aside>
        </div>
      </template>
    </template>
  </div>
</template>
