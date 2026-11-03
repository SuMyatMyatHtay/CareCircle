<script setup>
import { computed, inject, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { routeLocationKey } from 'vue-router'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { queryClient, queryKeys } from '../../../services/queryClient.js'
import { deleteTask, getErrorMessage } from '../../my-tasks/services/myTasksApi.js'

const props = defineProps({ task: { type: Object, required: true }, disabled: Boolean })
const route = inject(routeLocationKey, { meta: {} })
const { families, selectedFamilyId } = useActiveFamily()
const id = value => String(value?._id || value || '')
const familyId = computed(() => id(props.task.family) || selectedFamilyId.value)
const visible = computed(() => {
  if (route.meta?.preview || ['completed', 'in_progress'].includes(props.task.status)) return false
  let me
  try { me = JSON.parse(sessionStorage.getItem('user') || '{}') } catch { return false }
  const family = families.value.find(entry => id(entry.id || entry._id) === familyId.value)
  const member = family?.members?.find(entry => id(entry.userId) === me.id)
  return Boolean(member && (member.role === 'admin' || id(props.task.createdBy) === me.id))
})
const open = ref(false), busy = ref(false), error = ref(''), trigger = ref(null), menu = ref(null), position = ref({})
const menuId = useId()
function close(focus = false) { open.value = false; if (focus) trigger.value?.focus() }
async function toggle() {
  if (open.value) return close(true)
  const rect = trigger.value.getBoundingClientRect()
  position.value = { left: `${Math.max(8, Math.min(rect.right - 190, window.innerWidth - 198))}px`, top: `${rect.bottom + 65 > window.innerHeight ? Math.max(8, rect.top - 60) : rect.bottom + 5}px` }
  open.value = true
  await nextTick(); menu.value?.querySelector('button')?.focus()
}
function outside(event) { if (!trigger.value?.contains(event.target) && !menu.value?.contains(event.target)) close() }
function keydown(event) { if (open.value && event.key === 'Escape') { event.preventDefault(); close(true) } }
const dismiss = () => close()
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', keydown)
  document.addEventListener('scroll', dismiss, true)
  window.addEventListener('resize', dismiss)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', keydown)
  document.removeEventListener('scroll', dismiss, true)
  window.removeEventListener('resize', dismiss)
})
watch([visible, familyId, () => props.task._id], () => { close(); error.value = '' })
async function remove() {
  if (!visible.value || busy.value || props.disabled) return
  close(true)
  const warning = props.task.recurringSeries ? ' This deletes only the displayed session; the remaining repeating sessions stay available.' : ''
  if (!window.confirm(`Delete “${props.task.title}”?${warning} This cannot be undone.`)) return
  const targetFamily = familyId.value, taskId = props.task._id, token = sessionStorage.getItem('token')
  busy.value = true; error.value = ''
  try {
    await deleteTask(targetFamily, taskId)
    if (token !== sessionStorage.getItem('token')) return
    await queryClient.cancelQueries({ queryKey: queryKeys.tasks(targetFamily) })
    if (token !== sessionStorage.getItem('token')) return
    queryClient.setQueryData(queryKeys.tasks(targetFamily), rows => rows?.filter(task => task._id !== taskId))
    void queryClient.invalidateQueries({ queryKey: queryKeys.family(targetFamily) })
    window.dispatchEvent(new CustomEvent('carecircle:task-updated', { detail: { familyId: targetFamily, taskId, deleted: true, action: 'delete', title: props.task.title } }))
  } catch (err) { if (token === sessionStorage.getItem('token')) error.value = getErrorMessage(err) }
  finally { busy.value = false }
}
</script>

<template>
  <div v-if="visible" class="task-delete-menu">
    <button ref="trigger" class="task-options" type="button" :disabled="busy || disabled" :aria-label="`Task options for ${task.title}`" aria-haspopup="menu" :aria-expanded="open" :aria-controls="open ? menuId : undefined" @click.stop="toggle" @keydown.down.prevent="toggle"><i class="bi bi-three-dots" aria-hidden="true"></i></button>
    <p v-if="error" class="task-delete-error" role="alert">{{ error }}</p>
    <Teleport to="body">
      <div v-if="open" :id="menuId" ref="menu" class="task-delete-dropdown" :style="position" role="menu" @keydown.tab="close()">
        <button type="button" role="menuitem" @click="remove"><i class="bi bi-trash3" aria-hidden="true"></i> Delete task</button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.task-delete-menu { position: absolute; right: 8px; top: 6px; }
.task-options { width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: var(--theme-text, #30332f); font-size: 20px; }
.task-options:hover, .task-options:focus-visible { background: var(--theme-soft, #e8f5e9); }
.task-delete-dropdown { position: fixed; z-index: 10050; width: 190px; padding: 6px; background: var(--theme-panel, #fff); border: 1px solid var(--theme-border, #dce7df); border-radius: 10px; box-shadow: 0 8px 24px #0003; }
.task-delete-dropdown button { width: 100%; padding: 12px; border: 0; border-radius: 6px; background: transparent; color: var(--theme-danger, #b33d3d); text-align: left; }
.task-delete-dropdown button:hover, .task-delete-dropdown button:focus-visible { background: var(--theme-soft, #e8f5e9); }
.task-delete-error { position: absolute; right: 0; top: 30px; width: 220px; padding: 10px; background: var(--theme-panel, #fff); color: #b33d3d; z-index: 3; border-radius: 8px; }
</style>
