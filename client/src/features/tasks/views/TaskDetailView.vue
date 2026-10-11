<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { recipientById, taskById, activeFamily } from '../../../data/mock.js'
const route = useRoute()
const person = computed(() => recipientById(route.params.recipientId))
const task = computed(() => taskById(route.params.taskId))
</script>
<template>
  <div v-if="task && person && task.familyId === activeFamily.id">
    <RouterLink to="/open-tasks">← Open tasks</RouterLink>
    <div class="page-head mt-3">
      <div class="eyebrow">{{ person.name }} · {{ task.type }}</div>
      <h1>{{ task.title }}</h1>
      <span class="chip">{{ task.status }}</span>
    </div>
    <div class="row g-3">
      <div class="col-lg-8">
        <div class="card p-4">
          <h5>When and where</h5>
          <p>{{ task.date }} at {{ task.time }} · {{ task.location }}</p>
          <h5>Details</h5>
          <p>{{ task.details }}</p>
          <h5>Who's helping?</h5>
          <p>{{ task.assignee || 'Nobody yet — this task is available.' }}</p>
          <button v-if="task.status === 'Available'" class="btn btn-primary align-self-start" disabled>
            Claim Task (teammate to implement)
          </button>
          <div class="demo-note mt-3">
            This prototype shows the correct navigation and eligibility state only. Claiming must be implemented and
            protected on the server.
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card p-4">
          <h5>Journey updates</h5>
          <RouterLink
            v-if="task.journey"
            :to="`/recipients/${person.id}/tasks/${task.id}/transit`"
            class="btn btn-outline-primary"
            >View transit mode →</RouterLink
          ><span v-else>No transit for this task.</span>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="card p-4">
    <h3>Task not available in this family</h3>
    <RouterLink to="/family">Back to family home</RouterLink>
  </div>
</template>
