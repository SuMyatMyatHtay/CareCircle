<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { recipientById, selectedTasks, careLogs, activeFamily } from '../../../data/mock.js'
const route = useRoute()
const person = computed(() => recipientById(route.params.recipientId))
</script>
<template>
  <div v-if="person && person.familyId === activeFamily.id">
    <RouterLink to="/family">← Family Home</RouterLink>
    <div class="card p-4 mt-3">
      <h1>{{ person.name }}</h1>
      <p>{{ person.condition }}</p>
    </div>
    <div class="row g-3 mt-2">
      <div
        v-for="item in [
          { name: 'Overview', slug: 'overview' },
          { name: 'Tasks', slug: 'tasks' },
          { name: 'Care Log', slug: 'log' },
          { name: 'Profile', slug: 'profile' },
        ]"
        :key="item.slug"
        class="col-6 col-lg-3"
      >
        <RouterLink class="card p-3 action-card" :to="`/recipients/${person.id}/${item.slug}`"
          >{{ item.name }} →</RouterLink
        >
      </div>
    </div>
    <div class="card p-4 mt-3">
      <h4>Care snapshot</h4>
      <p>{{ person.notes }}</p>
      <p>
        {{ selectedTasks.filter((t) => t.recipientId === person.id).length }} tasks ·
        {{ careLogs.filter((l) => l.recipientId === person.id).length }} notes
      </p>
    </div>
  </div>
  <div v-else>Recipient not in selected family. <RouterLink to="/family">Return home</RouterLink></div>
</template>
