<script setup>
import {computed,ref} from 'vue'
import {activeFamily,openTasks,recipientById,selectedRecipients} from '../../../data/mock.js'
const filter=ref('all')
const filtered=computed(()=>openTasks.value.filter(t=>filter.value==='all'||t.recipientId===filter.value))
</script>
<template>
<RouterLink to="/family">← Family Home</RouterLink><header class="page-head mt-3"><div class="eyebrow">{{activeFamily.name}}</div><h1>Open Tasks · {{filtered.length}}</h1><p class="muted">Unclaimed tasks where someone in this family needs help.</p></header>
<div class="d-flex align-items-center gap-2 mb-4"><label for="recipient-filter">Care recipient:</label><select id="recipient-filter" v-model="filter" class="form-select" style="max-width:280px"><option value="all">Everyone</option><option v-for="p in selectedRecipients" :key="p.id" :value="p.id">{{p.name}}</option></select></div>
<div v-if="!filtered.length" class="card p-4">No open tasks for this selection.</div>
<div class="row g-3"><div v-for="task in filtered" :key="task.id" class="col-md-6"><div class="card p-4 h-100"><span class="badge text-bg-warning align-self-start">Needs a volunteer</span><h4 class="mt-3">{{task.title}}</h4><p class="muted">For {{recipientById(task.recipientId)?.name}} · {{task.date}} at {{task.time}}</p><p>{{task.details}}</p><RouterLink class="btn btn-primary mt-auto" :to="`/recipients/${task.recipientId}/tasks/${task.id}`">View task / offer help →</RouterLink></div></div></div>
</template>