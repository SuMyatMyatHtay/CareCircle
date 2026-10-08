<script setup>
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import RecipientTabs from '../../../components/layout/RecipientTabs.vue'
import {recipientById,selectedTasks,activeFamily} from '../../../data/mock.js'
const route=useRoute();const person=computed(()=>recipientById(route.params.recipientId));const items=computed(()=>selectedTasks.value.filter(t=>t.recipientId===route.params.recipientId))
</script>
<template><div v-if="person && person.familyId===activeFamily.id"><RouterLink :to="`/recipients/${person.id}`">← Care hub</RouterLink><header class="page-head mt-3"><h1>Tasks for {{person.name}}</h1></header><RecipientTabs :id="person.id"/><div class="row g-3"><div v-for="status in ['Available','Claimed','Completed']" :key="status" class="col-lg-4"><div class="rounded-3 p-3 h-100" style="background:#edf2ee"><h4>{{status}} ({{items.filter(t=>t.status===status).length}})</h4><div v-for="task in items.filter(t=>t.status===status)" :key="task.id" class="card p-3 mb-3"><h5>{{task.title}}</h5><p class="muted">{{task.date}} · {{task.assignee||'Needs volunteer'}}</p><RouterLink :to="`/recipients/${person.id}/tasks/${task.id}`">Details →</RouterLink></div></div></div></div></div><div v-else>Wrong family selected. <RouterLink to="/family">Back home</RouterLink></div></template>