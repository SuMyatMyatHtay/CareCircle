<script setup>
import SectionCard from '../../../components/common/SectionCard.vue'
import CareAvatar from '../../../components/common/CareAvatar.vue'
defineProps({ updates: { type: Array, default: () => [] }, preview: Boolean })
</script>
<template>
  <SectionCard title="Recent updates" class="care-recent-updates">
    <ol v-if="updates.length" class="care-activity-list">
      <li v-for="update in updates.slice(0, 8)" :key="update._id">
        <CareAvatar
          :person="{ name: update.actor || 'Family', avatar: update.avatar }"
          size="small"
        />
        <div>
          <p>{{ update.text }}</p>
          <time>{{ update.time }}</time>
        </div>
      </li>
    </ol>
    <p v-else class="care-muted care-small">
      Task changes will appear here while you’re on this page.
    </p>
    <p v-if="!preview" class="care-activity-note">
      Task board checks for updates every 20 seconds. Care log updates will
      appear when the activity feed is connected.
    </p>
  </SectionCard>
</template>
