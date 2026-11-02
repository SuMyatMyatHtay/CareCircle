<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { getRecurringSeries, pauseRecurringSeries, getTaskErrorMessage } from '../services/tasksApi.js'
import { queryKeys } from '../../../services/queryClient.js'
const props = defineProps({ task: { type: Object, required: true }, disabled: Boolean })
const { selectedFamilyId, selectedFamily, isAdmin, isPreview } = useFamilyWorkspace()
const familyId = computed(() => String(props.task.family?._id || props.task.family || selectedFamilyId.value || ''))
const seriesId = computed(() => String(props.task.recurringSeries?._id || props.task.recurringSeries || ''))
const client = useQueryClient(), busy = ref(false), error = ref(''), open = ref(false)
const trigger = ref(null), menu = ref(null), position = ref({}), menuId = useId()
const query = useQuery({
  queryKey: computed(() => ['families', familyId.value, 'recurring-series']),
  queryFn: ({ queryKey }) => getRecurringSeries(queryKey[1]),
  enabled: computed(() => !isPreview && !!familyId.value && !!seriesId.value),
})
const series = computed(() => query.data.value?.find(entry => String(entry._id) === seriesId.value))
const allowed = computed(() => !isPreview && (isAdmin.value || selectedFamily.value?.overdueTaskDeletion === 'member'))
const visible = computed(() => allowed.value && props.task.status === 'open' && series.value && !series.value.paused)
function closeMenu(restoreFocus = false) {
  open.value = false
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}
function placeMenu() {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect(), style = getComputedStyle(trigger.value)
  position.value = {
    left: `${Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232))}px`,
    top: `${rect.bottom + 90 > window.innerHeight ? Math.max(8, rect.top - 70) : rect.bottom + 6}px`,
    '--menu-panel': style.getPropertyValue('--care-panel') || '#fff',
    '--menu-text': style.getPropertyValue('--care-text') || '#2f2f2f',
    '--menu-border': style.getPropertyValue('--care-border') || '#e4ece5',
    '--menu-soft': style.getPropertyValue('--care-soft') || '#e8f5e9',
  }
}
async function toggleMenu() {
  if (open.value) { closeMenu(true); return }
  if (!visible.value || busy.value || props.disabled) return
  placeMenu()
  open.value = true
  await nextTick()
  menu.value?.querySelector('[role=menuitem]')?.focus({ preventScroll: true })
}
function outside(event) {
  if (!trigger.value?.contains(event.target) && !menu.value?.contains(event.target)) closeMenu()
}
function escape(event) { if (open.value && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true) } }
const dismissOnMove = () => { if (open.value) placeMenu() }
watch([visible, familyId, seriesId], () => { closeMenu(); error.value = '' })
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape, true)
  document.addEventListener('scroll', dismissOnMove, true)
  window.addEventListener('resize', dismissOnMove)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape, true)
  document.removeEventListener('scroll', dismissOnMove, true)
  window.removeEventListener('resize', dismissOnMove)
})
async function stop() {
  if (!visible.value || busy.value || props.disabled) return
  closeMenu(true)
  if (!window.confirm('Stop this repeating schedule? Upcoming repeating sessions will be cancelled. Overdue tasks, one-off exceptions and work already started will be kept. You can resume it later.')) return
  const targetFamily = familyId.value, targetSeries = seriesId.value
  busy.value = true; error.value = ''
  try {
    await pauseRecurringSeries(targetFamily, targetSeries, true)
    await client.invalidateQueries({ queryKey: queryKeys.family(targetFamily) })
  } catch (err) { error.value = getTaskErrorMessage(err) }
  finally { busy.value = false }
}
</script>
<template>
  <div v-if="visible" class="recurring-task-menu">
    <button ref="trigger" type="button" class="recurring-options" :disabled="busy || disabled" :aria-label="`Options for ${task.title}`" aria-haspopup="menu" :aria-expanded="open" :aria-controls="open ? menuId : undefined" @click.stop="toggleMenu" @keydown.down.prevent="toggleMenu">
      <i class="bi bi-three-dots" aria-hidden="true"></i>
    </button>
    <p v-if="error" class="recurring-menu-error care-error care-small" role="alert">{{ error }}</p>
    <Teleport to="body">
      <div v-if="open" :id="menuId" ref="menu" class="recurring-task-dropdown" :style="position" role="menu" :aria-label="`Repeating task options for ${task.title}`" @keydown.tab="closeMenu()">
        <button type="button" role="menuitem" :disabled="busy || disabled" @click="stop"><i class="bi bi-pause-circle" aria-hidden="true"></i> Stop repeating</button>
      </div>
    </Teleport>
  </div>
</template>
<style scoped>
.recurring-task-menu { position: absolute; top: 8px; right: 9px; z-index: 2; }
.recurring-options { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--care-muted); font-size: 19px; }
.recurring-options:hover, .recurring-options[aria-expanded=true] { background: var(--care-soft); border-color: var(--care-border); color: var(--care-green); }
.recurring-options:focus-visible { outline: 2px solid var(--care-green); outline-offset: 2px; }
.recurring-task-dropdown { position: fixed; width: 224px; z-index: 10050; padding: 6px; border: 1px solid var(--menu-border); border-radius: 12px; background: var(--menu-panel); color: var(--menu-text); box-shadow: 0 8px 28px rgba(0, 0, 0, .18); }
.recurring-task-dropdown button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px; text-align: left; font-size: 13px; border: 0; border-radius: 7px; background: transparent; color: inherit; }
.recurring-task-dropdown button:hover, .recurring-task-dropdown button:focus-visible { background: var(--menu-soft); outline: none; }
.recurring-menu-error { position: absolute; right: 0; top: 34px; width: 220px; padding: 10px; background: var(--care-panel); border: 1px solid var(--care-border); border-radius: 8px; }
</style>
