import { computed, inject, provide, ref, watch } from 'vue'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { previewState, previewUser } from '../data/previewFamily.js'
import { apiError, listRecipients } from '../services/dashboardApi.js'

// Keep the injection key stable when Vite replaces this module during editing.
const WORKSPACE = Symbol.for('carecircle:family-workspace')

export function provideFamilyWorkspace(isPreview) {
  const active = useActiveFamily()
  const realRecipients = ref([])
  const recipientsLoading = ref(false)
  const recipientsError = ref('')
  const user = isPreview
    ? computed(() => ({
        ...previewUser,
        ...previewState.members.find(
          (member) => member.user._id === previewUser.id,
        )?.user,
        id: previewUser.id,
      }))
    : ref({})
  function refreshUser() {
    if (isPreview) return
    try {
      user.value = JSON.parse(sessionStorage.getItem('user') || '{}')
    } catch {
      user.value = {}
    }
  }
  refreshUser()
  const families = isPreview
    ? computed(() => [
        {
          ...previewState.family,
          members: previewState.members.map((member) => ({
            userId: member.user._id,
            role: member.role,
          })),
        },
      ])
    : active.families
  const selectedFamilyId = isPreview
    ? computed(() => previewState.family.id)
    : active.selectedFamilyId
  const selectedFamily = isPreview
    ? computed(() => families.value[0])
    : active.selectedFamily
  const recipients = isPreview
    ? computed(() => previewState.recipients)
    : realRecipients
  const isAdmin = computed(
    () =>
      selectedFamily.value?.members?.find(
        (member) => member.userId === user.value.id,
      )?.role === 'admin',
  )
  let requestVersion = 0
  async function loadRecipients() {
    if (isPreview) return
    const version = ++requestVersion
    const familyId = selectedFamilyId.value
    realRecipients.value = []
    recipientsError.value = ''
    recipientsLoading.value = Boolean(familyId)
    if (!familyId) return
    try {
      const result = await listRecipients(familyId)
      if (version === requestVersion) realRecipients.value = result
    } catch (error) {
      if (version === requestVersion)
        recipientsError.value = apiError(error, 'Care recipients')
    } finally {
      if (version === requestVersion) recipientsLoading.value = false
    }
  }
  if (!isPreview) watch(selectedFamilyId, loadRecipients, { immediate: true })
  const workspace = {
    isPreview,
    user,
    refreshUser,
    families,
    selectedFamily,
    selectedFamilyId,
    isAdmin,
    recipients,
    recipientsLoading,
    recipientsError,
    loadRecipients,
    isLoading: isPreview ? ref(false) : active.isLoading,
    errorMessage: isPreview ? ref('') : active.errorMessage,
    loadFamilies: isPreview ? async () => {} : active.loadFamilies,
    selectFamily: isPreview ? () => {} : active.selectFamily,
    homePath: isPreview ? '/preview/home' : '/home',
    settingsPath: isPreview ? '/preview/settings' : '/settings',
  }
  provide(WORKSPACE, workspace)
  return workspace
}

export function useFamilyWorkspace() {
  const workspace = inject(WORKSPACE)
  if (!workspace)
    throw new Error('Family pages must be rendered inside AppLayout.')
  return workspace
}
