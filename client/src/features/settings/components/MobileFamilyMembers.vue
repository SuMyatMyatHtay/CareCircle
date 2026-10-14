<script setup>
import CareAvatar from '../../../components/common/CareAvatar.vue'
defineProps({
  members: { type: Array, default: () => [] },
  userId: { type: String, default: '' },
  isAdmin: Boolean,
  loading: Boolean,
  busy: Boolean,
  error: { type: String, default: '' },
})
defineEmits(['manage', 'retry'])
</script>
<template>
  <section class="care-mobile-family-members" aria-label="Family members">
    <p v-if="loading" class="care-mobile-member-state" role="status">
      Loading family members…
    </p>
    <div
      v-else-if="error && !members.length"
      class="care-mobile-member-state care-error"
      role="alert"
    >
      {{ error }}
      <button class="care-text-button" @click="$emit('retry')">
        Try again
      </button>
    </div>
    <p v-else-if="!members.length" class="care-mobile-member-state">
      No members to show.
    </p>
    <ul v-else>
      <li v-for="member in members" :key="member.user._id">
        <button
          class="care-mobile-member-row"
          :disabled="busy || (!isAdmin && member.user._id !== userId)"
          :aria-label="`Manage ${member.user.name}${member.user._id === userId ? ' (you)' : ''}`"
          @click="$emit('manage', member)"
        >
          <CareAvatar :person="member.user" size="small" />
          <span class="care-mobile-member-name">
            <strong>
              {{ member.user.name }}
              <span v-if="member.user._id === userId">(you)</span>
            </strong>
            <small>{{ member.relationship || member.user.email }}</small>
          </span>
          <span
            class="care-pill"
            :class="
              member.role === 'admin'
                ? 'care-pill--green'
                : 'care-pill--neutral'
            "
          >
            {{ member.role === 'admin' ? 'Admin' : 'Member' }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
