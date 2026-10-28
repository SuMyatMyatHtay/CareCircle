<script setup>
import { computed, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { getRecurringSeries, pauseRecurringSeries, getTaskErrorMessage } from '../services/tasksApi.js'
import SectionCard from '../../../components/common/SectionCard.vue'
import ProfileAvatar from '../../../components/common/ProfileAvatar.vue'
import RecurringTaskEditModal from './RecurringTaskEditModal.vue'
import { recurrenceLabel } from '../../../../../shared/recurrence.js'
import { queryKeys } from '../../../services/queryClient.js'
const props = defineProps({ tasks: { type: Array, default: () => [] }, recipientId: { type: String, default: '' } })
const { selectedFamilyId, user } = useFamilyWorkspace()
const client = useQueryClient(), editing = ref(null), busy = ref(''), actionError = ref('')
watch(selectedFamilyId, () => { editing.value = null; actionError.value = '' })
const query = useQuery({ queryKey: computed(() => ['families', selectedFamilyId.value, 'recurring-series']), queryFn: ({ queryKey }) => getRecurringSeries(queryKey[1]), enabled: computed(() => !!selectedFamilyId.value) })
const entries = computed(() => (query.data.value || []).filter(series => !props.recipientId || String(series.template.recipient) === props.recipientId))
const seriesTasks = series => props.tasks.filter(task => String(task.recurringSeries?._id || task.recurringSeries) === String(series._id))
const next = series => seriesTasks(series).filter(task => !task.recurrenceDetached && ['open', 'claimed'].includes(task.status) && +new Date(task.startAt) > Date.now()).sort((a, b) => new Date(a.startAt) - new Date(b.startAt))[0]
const canManage = series => String(series.createdBy?._id || series.createdBy) === user.value.id
async function toggle(series) {
  busy.value = series._id; actionError.value = ''
  try {
    await pauseRecurringSeries(selectedFamilyId.value, series._id, !series.paused)
    await client.invalidateQueries({ queryKey: queryKeys.family(selectedFamilyId.value) })
    window.dispatchEvent(new CustomEvent('carecircle:task-updated', { detail: { familyId: selectedFamilyId.value, action: 'update', title: series.template.title } }))
  } catch (error) { actionError.value = getTaskErrorMessage(error) }
  finally { busy.value = '' }
}
</script>
<template>
  <SectionCard title="Repeating tasks" class="recurring-series-panel">
    <template #actions><small class="care-muted">Open-ended tasks are created four weeks ahead</small></template>
    <p v-if="query.isLoading.value" role="status">Loading repeating tasks…</p>
    <p v-else-if="query.isError.value" role="alert">Could not load repeating tasks. <button class="care-text-button" @click="query.refetch()">Try again</button></p>
    <p v-else-if="!entries.length" class="care-muted">No repeating tasks yet.</p>
    <div v-for="series in entries" :key="series._id" class="recurring-series-row">
      <i class="bi bi-repeat" aria-hidden="true"></i><div class="recurring-series-text"><strong>{{ next(series)?.title || series.template.title }}</strong><small>{{ recurrenceLabel(series.rule) }}<template v-if="series.rule.end.mode === 'on'"> · until {{ series.rule.end.until }}</template><template v-if="series.rule.end.mode === 'after'"> · {{ series.rule.end.count }} sessions</template><template v-if="series.paused"> · Paused</template></small><span v-if="series.usualHelper" class="recurring-helper"><ProfileAvatar :person="series.usualHelper" size="tiny" />{{ series.usualHelper.name }} is the usual helper</span><small v-else>Taken session by session</small></div>
      <div v-if="canManage(series)" class="recurring-series-buttons"><button class="care-button" :disabled="!next(series) || !!busy" @click="editing = next(series)">Edit</button><button class="care-button" :disabled="!!busy" @click="toggle(series)">{{ series.paused ? 'Resume' : 'Pause' }}</button></div>
    </div>
    <p v-if="actionError" role="alert" class="text-danger">{{ actionError }}</p>
    <RecurringTaskEditModal v-if="editing" :key="editing._id" :task="editing" :family-id="selectedFamilyId" @close="editing = null" @saved="editing = null" />
  </SectionCard>
</template>
<style scoped>
.recurring-series-panel{margin-bottom:22px;height:auto!important}.recurring-series-row{display:flex;gap:14px;align-items:center;padding:16px 0;border-bottom:1px solid var(--theme-border,#e4ece5)}.recurring-series-row:last-child{border-bottom:0}.recurring-series-row>i{background:var(--theme-soft,#e8f5e9);padding:10px;border-radius:12px;color:var(--theme-green,#2d7d43)}.recurring-series-text{display:grid;gap:5px;flex:1;min-width:0}.recurring-series-text small{color:var(--theme-muted,#717b8e);font-size:12px}.recurring-helper{display:flex;gap:7px;align-items:center;color:var(--theme-green,#2d7d43);font-size:12px}.recurring-series-buttons{display:flex;gap:8px}.recurring-series-buttons button{font-size:12px;padding:8px 12px}@media(max-width:600px){.recurring-series-row{flex-wrap:wrap}.recurring-series-buttons{margin-left:auto}}
</style>
