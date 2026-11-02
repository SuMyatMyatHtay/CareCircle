<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import CareModal from '../../../components/common/CareModal.vue'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { recurringClaim, closeRecurringClaim } from '../composables/recurringClaimDialog.js'
const scope = ref('series')
const { selectedFamilyId } = useFamilyWorkspace()
const route = useRoute()
watch(recurringClaim, () => { scope.value = 'series' })
watch([selectedFamilyId, () => route.fullPath], () => closeRecurringClaim())
const options = [
  { key: 'one', title: 'Just this date', detail: 'Take only this session. The other dates stay available.' },
  { key: 'next4', title: 'The next 4 sessions', detail: 'Take this session and the next three available dates. Later dates stay with the family.' },
  { key: 'series', title: 'Every upcoming session', detail: 'Become the usual helper, including future generated sessions. You can release an individual date anytime.' },
]
</script>
<template>
  <CareModal v-if="recurringClaim" :title="`Take ${recurringClaim.title}?`" @close="closeRecurringClaim()">
    <p class="care-muted">{{ recurringClaim.recurrenceLabel }} · Choose how many sessions you can help with.</p>
    <label v-for="option in options" :key="option.key" class="recurring-scope-option" :class="{ selected: scope === option.key }"><input v-model="scope" type="radio" name="recurring-claim" :value="option.key"><span><strong>{{ option.title }}</strong><small>{{ option.detail }}</small></span></label>
    <div class="recurring-dialog-buttons"><button type="button" class="care-button" @click="closeRecurringClaim()">Not now</button><button type="button" class="care-button care-button--green" @click="closeRecurringClaim(scope)">I'll take it</button></div>
  </CareModal>
</template>
<style>
.recurring-scope-option{display:flex;gap:12px;padding:16px;border:1px solid var(--theme-border,#e4ece5);border-radius:14px;margin:12px 0;cursor:pointer;color:var(--theme-text,#30332f)}.recurring-scope-option.selected{border:2px solid var(--theme-green,#2d7d43);background:var(--theme-soft,#e8f5e9);padding:15px}.recurring-scope-option input{margin-top:4px;accent-color:var(--theme-green,#2d7d43)}.recurring-scope-option span{display:grid;gap:5px}.recurring-scope-option small{color:var(--theme-muted,#717b8e);font-size:12px}.recurring-dialog-buttons{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
</style>
