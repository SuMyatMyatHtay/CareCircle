<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { queryClient, queryKeys } from '../../../services/queryClient.js'
import { archiveRecipient, getRecipientErrorMessage } from '../services/recipientsApi.js'

const props = defineProps({ recipient: { type: Object, required: true } })
const router = useRouter()
const { selectedFamily, selectedFamilyId } = useActiveFamily()
const busy = ref(false), error = ref('')
const id = value => String(value?._id || value || '')
const allowed = computed(() => {
  let user
  try { user = JSON.parse(sessionStorage.getItem('user') || '{}') } catch { return false }
  if (props.recipient.family && id(props.recipient.family) !== selectedFamilyId.value) return false
  const member = selectedFamily.value?.members?.find(member => id(member.userId) === user.id)
  return Boolean(member && (member.role === 'admin' || selectedFamily.value.recipientDeletion === 'member'))
})
async function remove() {
  if (!allowed.value || busy.value) return
  if (!window.confirm(`Remove ${props.recipient.nickname || props.recipient.name} from this family’s active recipients? Their tasks and care logs will be kept.`)) return
  const familyId = selectedFamilyId.value, token = sessionStorage.getItem('token'), recipientId = props.recipient._id
  busy.value = true; error.value = ''
  try {
    await archiveRecipient(familyId, recipientId)
    if (token !== sessionStorage.getItem('token')) return
    await queryClient.cancelQueries({ queryKey: queryKeys.recipients(familyId) })
    if (token !== sessionStorage.getItem('token')) return
    queryClient.setQueryData(queryKeys.recipientList(familyId), rows => rows?.filter(recipient => recipient._id !== recipientId))
    void queryClient.invalidateQueries({ queryKey: queryKeys.recipients(familyId) })
    if (selectedFamilyId.value === familyId) await router.push('/home')
  } catch (err) {
    if (token === sessionStorage.getItem('token') && selectedFamilyId.value === familyId) error.value = getRecipientErrorMessage(err)
  } finally { busy.value = false }
}
</script>

<template>
  <div v-if="allowed" class="remove-recipient">
    <button type="button" :disabled="busy" @click="remove"><i class="bi bi-person-dash" aria-hidden="true"></i> {{ busy ? 'Removing…' : 'Remove recipient' }}</button>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.remove-recipient button { display: inline-flex; align-items: center; gap: 8px; padding: 14px 18px; border: 1px solid var(--theme-danger, #c0564b); border-radius: 12px; background: var(--theme-panel, #fff); color: var(--theme-danger, #c0564b); font-weight: 650; }
.remove-recipient button:disabled { opacity: .6; cursor: wait; }
.remove-recipient p { max-width: 280px; margin: 8px 0 0; color: var(--theme-danger, #c0564b); font-size: 12px; }
</style>
