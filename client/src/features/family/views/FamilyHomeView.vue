<script setup>
import { activeFamily, selectedRecipients, selectedTasks, openTasks, currentUser } from '../../../data/mock.js'
</script>
<template>
  <div class="page-head">
    <div class="eyebrow">{{ activeFamily.name }}</div>
    <h1>Family Home</h1>
    <p class="muted">Hi {{ currentUser.name }}. Switch families using the selector at the top.</p>
  </div>
  <div class="row g-3 mb-4">
    <div class="col-sm-4">
      <div class="card p-3">
        <div>Care recipients</div>
        <h2>{{ selectedRecipients.length }}</h2>
      </div>
    </div>
    <div class="col-sm-4">
      <div class="card p-3">
        <div>Open tasks (need help)</div>
        <h2>{{ openTasks.length }}</h2>
        <RouterLink to="/open-tasks">Browse open tasks →</RouterLink>
      </div>
    </div>
    <div class="col-sm-4">
      <div class="card p-3">
        <div>Upcoming tasks</div>
        <h2>{{ selectedTasks.filter((t) => t.status !== 'Completed').length }}</h2>
      </div>
    </div>
  </div>
  <div class="card p-4 mb-4">
    <div class="d-flex justify-content-between flex-wrap gap-2">
      <h3>Tasks needing help</h3>
      <RouterLink class="btn btn-primary" to="/open-tasks">View all open tasks →</RouterLink>
    </div>
    <div v-for="task in openTasks.slice(0, 3)" :key="task.id" class="py-3 border-bottom">
      <strong>{{ task.title }}</strong> · {{ task.date }} {{ task.time }}
      <RouterLink :to="`/recipients/${task.recipientId}/tasks/${task.id}`">View →</RouterLink>
    </div>
    <p v-if="!openTasks.length" class="muted mt-3">Everything is covered for now.</p>
  </div>
  <h3>People we care for</h3>
  <div class="row g-3">
    <div v-for="person in selectedRecipients" :key="person.id" class="col-md-4">
      <RouterLink :to="`/recipients/${person.id}`" class="card p-4 h-100 d-block action-card text-reset">
        <h4>{{ person.name }}</h4>
        <p class="muted">{{ person.condition }}</p>
        <span class="text-success">Open care hub →</span>
      </RouterLink>
    </div>
  </div>
</template>
