<script setup>
import { useRoute } from 'vue-router'
import RecipientTabs from '../../../components/layout/RecipientTabs.vue'
import { recipientById } from '../../../data/mock.js'
const id = useRoute().params.recipientId
const person = recipientById(id)
</script>
<template>
  <RouterLink :to="`/recipients/${id}`">← {{ person.name }} hub</RouterLink>
  <div class="page-head mt-3">
    <div class="eyebrow">Care information</div>
    <h1>{{ person.name }}'s profile</h1>
    <p class="muted">Helpful context for every caregiver.</p>
  </div>
  <RecipientTabs :id="id" />
  <div class="row g-3">
    <div class="col-lg-7">
      <div class="card p-4">
        <h4>At a glance</h4>
        <dl class="row mt-3">
          <dt class="col-sm-4">Age</dt>
          <dd class="col-sm-8">{{ person.age }}</dd>
          <dt class="col-sm-4">Support needs</dt>
          <dd class="col-sm-8">{{ person.condition }}</dd>
          <dt class="col-sm-4">Allergies</dt>
          <dd class="col-sm-8">{{ person.allergies }}</dd>
          <dt class="col-sm-4">Mobility</dt>
          <dd class="col-sm-8">{{ person.mobility }}</dd>
          <dt class="col-sm-4">Primary contact</dt>
          <dd class="col-sm-8">{{ person.contact }}</dd>
        </dl>
      </div>
    </div>
    <div class="col-lg-5">
      <div class="card p-4">
        <h4>Care instructions</h4>
        <p>{{ person.notes }}</p>
        <div class="demo-note">Editing profiles, validation and permissions are not implemented yet.</div>
      </div>
    </div>
  </div>
</template>
