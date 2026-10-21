<script setup>
import { computed, ref } from 'vue'
import SectionCard from '../../../components/common/SectionCard.vue'
import CareAvatar from '../../../components/common/CareAvatar.vue'
const props = defineProps({
  members: { type: Array, default: () => [] },
  userId: { type: String, default: '' },
  isAdmin: Boolean,
  loading: Boolean,
  busy: Boolean,
  error: { type: String, default: '' },
})
const emit = defineEmits(['invite', 'change-role', 'remove', 'retry'])
const openMenu = ref('')
const adminCount = computed(
  () => props.members.filter((member) => member.role === 'admin').length,
)
const languages = {
  en: 'English',
  zh: '中文',
  ms: 'Bahasa Melayu',
  ta: 'தமிழ்',
}
function changeRole(member) {
  emit('change-role', member, member.role === 'admin' ? 'member' : 'admin')
  openMenu.value = ''
}
function removeMember(member) {
  emit('remove', member)
  openMenu.value = ''
}
</script>
<template>
  <SectionCard :title="`Members · ${members.length}`" class="care-members-card">
    <template #actions>
      <button
        class="care-button"
        :disabled="!isAdmin || busy"
        @click="$emit('invite')"
      >
        Invite member
      </button>
    </template>
    <div v-if="loading" class="care-status" role="status">
      Loading family members…
    </div>
    <div v-else-if="error && !members.length" class="care-error" role="alert">
      {{ error }}
      <button class="care-text-button" @click="$emit('retry')">
        Try again
      </button>
    </div>
    <p v-else-if="!members.length" class="care-muted care-small">
      No members to show.
    </p>
    <ul v-else class="care-member-list">
      <li v-for="member in members" :key="member.user._id">
        <CareAvatar :person="member.user" size="small" />
        <div class="care-member-info">
          <strong>
            {{ member.user.name }}
            <span v-if="member.user._id === userId">(you)</span>
          </strong>
          <p>
            <template v-if="member.relationship">
              {{ member.relationship }} ·
            </template>
            {{ member.user.email }}
          </p>
        </div>
        <span class="care-pill care-pill--neutral care-member-language">
          {{ languages[member.user.preferredLang] || 'English' }}
        </span>
        <span
          class="care-pill"
          :class="
            member.role === 'admin' ? 'care-pill--green' : 'care-pill--neutral'
          "
        >
          {{ member.role === 'admin' ? 'Admin' : 'Member' }}
        </span>
        <div v-if="isAdmin" class="care-member-menu">
          <button
            class="care-icon-button"
            :aria-label="`Manage ${member.user.name}`"
            :aria-expanded="openMenu === member.user._id"
            :disabled="busy"
            @click="
              openMenu = openMenu === member.user._id ? '' : member.user._id
            "
          >
            <i class="bi bi-three-dots" aria-hidden="true"></i>
          </button>
          <div v-if="openMenu === member.user._id" class="care-member-popover">
            <button
              :disabled="busy || (member.role === 'admin' && adminCount === 1)"
              @click="changeRole(member)"
            >
              {{ member.role === 'admin' ? 'Change to member' : 'Make admin' }}
            </button>
            <button
              class="care-danger-text"
              :disabled="busy || (member.role === 'admin' && adminCount === 1)"
              @click="removeMember(member)"
            >
              {{
                member.user._id === userId
                  ? 'Leave family'
                  : 'Remove from family'
              }}
            </button>
            <p v-if="member.role === 'admin' && adminCount === 1">
              At least one admin must stay.
            </p>
            <button @click="openMenu = ''">Close</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-if="!isAdmin" class="care-muted care-small mt-3 mb-0">
      Admins can invite members and manage roles.
    </p>
  </SectionCard>
</template>
