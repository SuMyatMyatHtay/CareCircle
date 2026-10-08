<script setup>
import {useRouter} from 'vue-router'
import {currentUser,families,demoState,selectFamily} from '../../data/mock.js'
const router=useRouter()
function switchFamily(event){selectFamily(event.target.value);router.push('/family')}
</script>
<template>
<nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top"><div class="container gap-2">
  <RouterLink class="navbar-brand fw-bold" to="/family">● CareCircle</RouterLink>
  <div class="d-flex align-items-center gap-2 flex-wrap">
    <label for="family-picker" class="small mb-0">Family:</label>
    <select id="family-picker" class="form-select form-select-sm" style="width:auto" :value="demoState.activeFamilyId" @change="switchFamily"><option v-for="f in families" :key="f.id" :value="f.id">{{f.name}}</option></select>
    <RouterLink class="nav-link" to="/family">Family Home</RouterLink>
    <RouterLink class="nav-link" to="/open-tasks">Open Tasks</RouterLink>
    <RouterLink class="nav-link" to="/my-tasks">My Tasks</RouterLink>
    <RouterLink class="nav-link" to="/family/settings">Settings</RouterLink>
    <RouterLink class="nav-link" to="/login">{{currentUser.initials}}</RouterLink>
  </div></div></nav>
</template>
