<script setup>
import { activeFamily } from '../../../data/mock.js'
</script>
<template>
  <header class="page-head">
    <h1>Family settings</h1>
    <p>{{ activeFamily.name }}</p>
  </header>
  <div class="card p-4">
    <h4>Members</h4>
    <div v-for="member in activeFamily.members" :key="member.id" class="py-2 border-bottom">
      {{ member.name }} — {{ member.role }}
    </div>
    <h5 class="mt-4">Invite code: {{ activeFamily.inviteCode }}</h5>
    <p class="muted">Joining and role management require backend implementation.</p>
  </div>
</template>
