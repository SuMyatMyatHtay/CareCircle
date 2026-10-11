<script setup>
import { useRoute } from 'vue-router'
import RecipientTabs from '../../../components/layout/RecipientTabs.vue'
import { recipientById, careLogs } from '../../../data/mock.js'
const id = useRoute().params.recipientId
const person = recipientById(id)
const entries = careLogs.filter((l) => l.recipientId === id)
</script>
<template>
  <RouterLink :to="`/recipients/${id}`">← {{ person.name }} hub</RouterLink>
  <div class="page-head mt-3">
    <div class="eyebrow">Shared care history</div>
    <h1>{{ person.name }}'s care log</h1>
    <p class="muted">Notes everyone can refer back to.</p>
  </div>
  <RecipientTabs :id="id" />
  <div class="row g-3">
    <div class="col-lg-8">
      <div v-for="entry in entries" :key="entry.id" class="card p-4 mb-3">
        <div class="d-flex justify-content-between">
          <span class="chip">{{ entry.category }}</span
          ><span class="muted small">{{ entry.date }}</span>
        </div>
        <h4 class="mt-3">{{ entry.title }}</h4>
        <p>{{ entry.text }}</p>
        <div class="muted small">Added by {{ entry.author }}</div>
      </div>
    </div>
    <div class="col-lg-4">
      <div class="card p-4">
        <h5>Add a care note</h5>
        <p class="muted">Capture consultation notes, medication changes, or daily updates.</p>
        <button class="btn btn-outline-primary pointer-disabled" disabled>+ New entry</button>
        <div class="demo-note mt-3">Care-log creation/editing and secure persistence are for the feature owner.</div>
      </div>
    </div>
  </div>
</template>
