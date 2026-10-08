<script setup>
import {computed} from 'vue'
import {currentUser,families,tasks,recipientById,selectFamily} from '../../../data/mock.js'
import {useRouter} from 'vue-router'
const router=useRouter()
const mine=computed(()=>tasks.filter(t=>t.assignee===currentUser.name))
function openTask(t){selectFamily(t.familyId);router.push(`/recipients/${t.recipientId}/tasks/${t.id}`)}
</script>
<template><div class="page-head"><h1>My Tasks</h1><p class="muted">All your assignments, across both families.</p></div><div v-for="task in mine" :key="task.id" class="card p-4 mb-3"><span class="small muted">{{families.find(f=>f.id===task.familyId)?.name}} · {{recipientById(task.recipientId)?.name}}</span><h4>{{task.title}}</h4><p>{{task.date}} at {{task.time}} · {{task.status}}</p><button class="btn btn-outline-primary align-self-start" @click="openTask(task)">View task →</button></div><RouterLink to="/open-tasks">Looking to help more? Browse open tasks →</RouterLink></template>