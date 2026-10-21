<script setup>
defineProps({ busy: Boolean })
defineEmits(['logout'])
</script>
<template>
  <button class="care-mobile-logout" :disabled="busy" @click="$emit('logout')">
    {{ busy ? 'Logging out…' : 'Log out' }}
  </button>
</template>
