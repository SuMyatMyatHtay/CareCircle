<script setup>
import { computed } from 'vue'
import SectionCard from '../../../components/common/SectionCard.vue'
import ProfileAvatar from '../../../components/common/ProfileAvatar.vue'
import { useFamilyWorkspace } from '../composables/useFamilyWorkspace.js'
import { useRecentNotifications } from '../../settings/composables/useNotifications.js'

const props = defineProps({ updates: { type: Array, default: () => [] }, preview: Boolean, description: { type: String, default: '' } })

// Real families: show the family's notifications. Until the first ones arrive (and in preview),
// fall back to the in-session updates passed in by the dashboard.
const workspace = useFamilyWorkspace()
const feed = useRecentNotifications(() => (props.preview ? '' : workspace.selectedFamilyId.value || ''))
const shown = computed(() => (feed.items.value.length ? feed.items.value : props.updates))
</script>
<template>
  <SectionCard title="Recent updates" class="care-recent-updates">
    <p v-if="description" class="care-muted care-small">{{ description }}</p>
    <div class="care-home-panel-scroll" role="region" aria-label="Recent family updates" tabindex="0">
    <TransitionGroup
      v-if="shown.length"
      name="care-list"
      tag="ol"
      class="care-activity-list"
    >
      <li v-for="update in shown.slice(0, 8)" :key="update._id">
        <ProfileAvatar
          :person="{ _id: update.actorId, name: update.actor || 'Family', avatar: update.avatar, profilePicture: update.profilePicture }"
          size="small"
        />
        <div>
          <p>{{ update.text }}</p>
          <time>{{ update.time }}</time>
        </div>
      </li>
    </TransitionGroup>
    <p v-else class="care-muted care-small">
      Task changes will appear here while you’re on this page.
    </p>
    </div>
    <p v-if="!preview" class="care-activity-note">
      Task and care note updates from the whole family. Checks for new ones every 20 seconds.
    </p>
  </SectionCard>
</template>
