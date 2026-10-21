<script setup>
import CareModal from '../../../components/common/CareModal.vue'
import CareAvatar from '../../../components/common/CareAvatar.vue'
defineProps({ recipient: { type: Object, required: true } })
defineEmits(['close'])
</script>
<template>
  <CareModal
    :title="recipient.nickname || recipient.name"
    @close="$emit('close')"
  >
    <div class="care-recipient-heading mb-4">
      <CareAvatar :person="recipient" />
      <div>
        <strong>{{ recipient.name }}</strong>
        <p>{{ recipient.careType || 'Care recipient' }}</p>
      </div>
    </div>
    <dl class="care-profile-summary">
      <template v-if="recipient.mobility">
        <dt>Mobility</dt>
        <dd>{{ recipient.mobility }}</dd>
      </template>
      <template v-if="recipient.careNotes">
        <dt>Care notes</dt>
        <dd>{{ recipient.careNotes }}</dd>
      </template>
    </dl>
    <p class="care-muted care-small">
      This is a quick overview. The full Recipient Hub will be connected when
      the recipient pages are ready.
    </p>
    <button class="care-button" @click="$emit('close')">Back to family</button>
  </CareModal>
</template>
