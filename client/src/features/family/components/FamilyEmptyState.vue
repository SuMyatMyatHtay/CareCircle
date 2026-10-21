<script setup>
defineProps({ error: { type: String, default: '' }, loading: Boolean })
defineEmits(['retry'])
</script>
<template>
  <div v-if="loading" class="care-status" role="status">
    <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
    Gathering your family circles…
  </div>
  <section v-else class="care-empty-family">
    <span class="empty-family-symbol" aria-hidden="true">
      {{ error ? '🌧️' : '🏡' }}
    </span>
    <h2>
      {{ error ? 'We couldn’t load your families' : 'Your circle starts here' }}
    </h2>
    <p>
      {{
        error ||
        'Create a family or join your loved ones to start caring together.'
      }}
    </p>
    <button
      v-if="error"
      class="care-button care-button--primary"
      @click="$emit('retry')"
    >
      Try again
    </button>
    <div v-else class="care-actions">
      <RouterLink to="/create-family" class="care-button care-button--primary">
        Create a family
      </RouterLink>
      <RouterLink to="/join-family" class="care-button">
        Join a family
      </RouterLink>
    </div>
  </section>
</template>
