<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SectionCard from '../../../components/common/SectionCard.vue'
import CareModal from '../../../components/common/CareModal.vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { queryClient, queryKeys } from '../../../services/queryClient.js'
import { http } from '../../../services/http.js'
import { authConfig, apiError } from '../../family/services/dashboardApi.js'

const { selectedFamily, selectedFamilyId, isAdmin, isPreview } = useFamilyWorkspace()
const active = useActiveFamily(), router = useRouter()
const open = ref(false), name = ref(''), acknowledged = ref(false), busy = ref(false), error = ref('')
watch(selectedFamilyId, () => { open.value = false; name.value = ''; acknowledged.value = false; error.value = '' })
function show() { name.value = ''; acknowledged.value = false; error.value = ''; open.value = true }
async function remove() {
  if (busy.value || !isAdmin.value || isPreview || name.value !== selectedFamily.value?.name || !acknowledged.value) return
  const familyId = selectedFamilyId.value, token = sessionStorage.getItem('token')
  busy.value = true; error.value = ''
  try {
    await http.delete(`/families/${familyId}`, { ...authConfig(), data: { confirmed: true, familyName: name.value } })
    if (token !== sessionStorage.getItem('token')) return
    await queryClient.cancelQueries({ queryKey: queryKeys.family(familyId) })
    if (token !== sessionStorage.getItem('token')) return
    queryClient.removeQueries({ queryKey: queryKeys.family(familyId) })
    active.families.value = active.families.value.filter(family => family.id !== familyId)
    if (active.selectedFamilyId.value === familyId) active.selectFamily(active.families.value[0]?.id || '')
    open.value = false
    await active.loadFamilies()
    if (token === sessionStorage.getItem('token')) await router.push('/home')
  } catch (err) { if (token === sessionStorage.getItem('token') && selectedFamilyId.value === familyId) error.value = apiError(err, 'Delete family') }
  finally { busy.value = false }
}
</script>

<template>
  <SectionCard v-if="selectedFamily && isAdmin && !isPreview" title="Delete family" class="delete-family-card">
    <p>Permanently delete {{ selectedFamily.name }} and its care information for everyone in this family.</p>
    <button type="button" class="delete-family-button" @click="show">Delete family</button>
    <CareModal v-if="open" title="Permanently delete this family?" @close="!busy && (open = false)">
      <p role="alert">This permanently deletes all family tasks (including completed tasks), recurring schedules, recipients, care logs, trips and updates. Everyone will lose access. This cannot be undone.</p>
      <p>Member accounts and other families are kept.</p>
      <form @submit.prevent="remove">
        <label class="delete-family-name">Type <strong>{{ selectedFamily.name }}</strong> to confirm<input v-model="name" :disabled="busy" autocomplete="off" required /></label>
        <label class="delete-family-ack"><input v-model="acknowledged" type="checkbox" :disabled="busy" /> I understand this permanently deletes the whole family's care information.</label>
        <p v-if="error" role="alert" class="care-error">{{ error }}</p>
        <div class="delete-family-actions"><button type="button" class="care-button" :disabled="busy" @click="open = false">Cancel</button><button type="submit" class="delete-family-button" :disabled="busy || !acknowledged || name !== selectedFamily.name">{{ busy ? 'Deleting…' : 'Permanently delete family' }}</button></div>
      </form>
    </CareModal>
  </SectionCard>
</template>

<style scoped>
.delete-family-card { border-color: var(--theme-danger, #c0564b); height: auto !important; margin-top: 20px; }
.delete-family-card p { font-size: 13px; line-height: 1.6; }
.delete-family-button { padding: 12px 16px; border: 1px solid #b84237; border-radius: 10px; background: #b84237; color: white; font-weight: 650; }
.delete-family-button:disabled { opacity: .5; }
.delete-family-name { display: block; margin: 16px 0; }
.delete-family-name input { display: block; width: 100%; margin-top: 8px; padding: 10px; border: 1px solid var(--theme-border, #ddd); border-radius: 8px; background: var(--theme-panel, #fff); color: inherit; }
.delete-family-ack { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; }
.delete-family-ack input { margin-top: 4px; flex-shrink: 0; }
.delete-family-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; margin-top: 20px; }
</style>
