import { computed, ref, watch } from 'vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { previewState } from '../../family/data/previewFamily.js'
import { apiError } from '../../family/services/dashboardApi.js'
import * as api from '../services/settingsApi.js'

export function useFamilySettings() {
  const workspace = useFamilyWorkspace()
  const realMembers = ref([]),
    loading = ref(false),
    membersError = ref(''),
    error = ref(''),
    busy = ref(false),
    feedback = ref('')
  const members = workspace.isPreview
    ? computed(() => previewState.members)
    : realMembers
  const language = computed(() => workspace.user.value.preferredLang || 'en')
  let version = 0
  async function loadMembers() {
    if (workspace.isPreview) return
    const current = ++version,
      familyId = workspace.selectedFamilyId.value
    realMembers.value = []
    membersError.value = ''
    loading.value = Boolean(familyId)
    if (!familyId) return
    try {
      const result = await api.getMembers(familyId)
      if (current === version) {
        realMembers.value = result
        syncFamilyMembers()
      }
    } catch (err) {
      if (current === version)
        membersError.value = apiError(err, 'Family members')
    } finally {
      if (current === version) loading.value = false
    }
  }
  function syncFamilyMembers() {
    if (!workspace.isPreview && workspace.selectedFamily.value)
      workspace.selectedFamily.value.members = realMembers.value.map(
        (member) => ({ userId: member.user._id, role: member.role }),
      )
  }
  async function changeRole(member, role) {
    const familyId = workspace.selectedFamilyId.value
    if (workspace.isPreview) {
      if (!workspace.isAdmin.value)
        throw new Error('Only admins can change roles.')
      if (
        member.role === 'admin' &&
        role === 'member' &&
        members.value.filter((entry) => entry.role === 'admin').length <= 1
      )
        throw new Error('Your family needs at least one admin.')
      member.role = role
    } else {
      const updated = await api.changeMemberRole(
        familyId,
        member.user._id,
        role,
      )
      if (familyId !== workspace.selectedFamilyId.value) return
      const index = realMembers.value.findIndex(
        (entry) => entry.user._id === member.user._id,
      )
      if (index >= 0) realMembers.value[index] = updated
      syncFamilyMembers()
    }
    feedback.value = `${member.user.name} is now ${role === 'admin' ? 'an admin' : 'a member'}.`
  }
  async function deleteMember(member) {
    const familyId = workspace.selectedFamilyId.value
    if (workspace.isPreview) {
      if (!workspace.isAdmin.value)
        throw new Error('Only admins can remove other members.')
      if (
        member.role === 'admin' &&
        members.value.filter((entry) => entry.role === 'admin').length <= 1
      )
        throw new Error('Your family needs at least one admin.')
      // Keep the preview account so the sample always remains navigable.
      if (member.user._id === workspace.user.value.id)
        throw new Error(
          'Keep the sample account in this preview. Try removing another member.',
        )
      previewState.members.splice(previewState.members.indexOf(member), 1)
    } else {
      await api.removeMember(familyId, member.user._id)
      if (familyId !== workspace.selectedFamilyId.value) return
      realMembers.value = realMembers.value.filter(
        (entry) => entry.user._id !== member.user._id,
      )
      syncFamilyMembers()
      if (member.user._id === workspace.user.value.id)
        await workspace.loadFamilies()
    }
    feedback.value = `${member.user.name} was removed from the family.`
  }
  async function regenerateCode() {
    const familyId = workspace.selectedFamilyId.value
    let code
    if (workspace.isPreview) {
      if (!workspace.isAdmin.value)
        throw new Error('Only admins can regenerate the invite code.')
      code = [...crypto.getRandomValues(new Uint8Array(5))]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
      previewState.family.inviteCode = code
    } else {
      code = await api.regenerateInviteCode(familyId)
      if (familyId !== workspace.selectedFamilyId.value) return
      workspace.selectedFamily.value.inviteCode = code
    }
    feedback.value = 'New invite code ready. The previous code no longer works.'
  }
  async function changeLanguage(value) {
    if (workspace.isPreview) {
      const self = previewState.members.find(
        (member) => member.user._id === workspace.user.value.id,
      )
      if (self) self.user.preferredLang = value
    } else {
      await api.saveLanguage(value)
      workspace.refreshUser()
      await loadMembers()
    }
    feedback.value = 'Your language preference has been saved.'
  }
  async function changeProfile({ name, phone }) {
    if (name.length < 2 || name.length > 80 || phone.length > 30) {
      throw new Error('Please check your profile details.')
    }
    if (workspace.isPreview) {
      const self = previewState.members.find(
        (member) => member.user._id === workspace.user.value.id,
      )
      if (self) Object.assign(self.user, { name, phone })
    } else {
      await api.saveProfile({ name, phone })
      workspace.refreshUser()
      await loadMembers()
    }
    feedback.value = 'Your profile has been saved.'
  }
  async function run(action) {
    if (busy.value) return false
    const familyId = workspace.selectedFamilyId.value
    busy.value = true
    feedback.value = ''
    error.value = ''
    try {
      await action()
      return familyId === workspace.selectedFamilyId.value
    } catch (err) {
      if (familyId === workspace.selectedFamilyId.value) {
        error.value = apiError(err, 'Family settings')
        if (err.response?.status === 409) await loadMembers()
      }
      return false
    } finally {
      if (familyId === workspace.selectedFamilyId.value) busy.value = false
    }
  }
  watch(
    workspace.selectedFamilyId,
    () => {
      version++
      busy.value = false
      feedback.value = ''
      error.value = ''
      loadMembers()
    },
    { immediate: true },
  )
  return {
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
  }
}
