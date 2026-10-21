<script setup>
import { ref, nextTick, watch } from 'vue'
import AssistantAvatar from './AssistantAvatar.vue'
const props = defineProps({ user: { type: Object, default: () => ({}) } })
const opened = ref(false), launcher = ref(null), closeButton = ref(null)
async function toggle() {
  opened.value = !opened.value
  await nextTick()
  if (opened.value) closeButton.value?.focus()
  else launcher.value?.focus()
}
watch(() => props.user?.id, () => { opened.value = false })
</script>

<template>
  <div class="assistant-widget" @keydown.esc.stop="opened && toggle()">
    <section v-if="opened" id="carecircle-assistant-panel" class="assistant-panel" role="region" aria-label="CareCircle assistant">
      <header class="assistant-header">
        <AssistantAvatar :appearance="user.avatarAppearance" />
        <div><h2>CareCircle assistant</h2><p>Your personal care companion</p></div>
        <button ref="closeButton" type="button" class="assistant-minimize" aria-label="Minimize assistant" @click="toggle"><i class="bi bi-dash-lg" aria-hidden="true"></i></button>
      </header>
      <div class="assistant-welcome">
        <AssistantAvatar :appearance="user.avatarAppearance" size="large" />
        <h3>A little help for your circle</h3>
        <p>Chat is coming soon. You'll be able to find, add and update family tasks here.</p>
        <span class="assistant-status">Coming soon</span>
      </div>
    </section>
    <button ref="launcher" type="button" class="assistant-launcher" :class="{ 'is-open': opened }" :aria-label="opened ? 'Minimize CareCircle assistant' : 'Open CareCircle assistant'" :aria-expanded="opened" :aria-controls="opened ? 'carecircle-assistant-panel' : undefined" @click="toggle">
      <AssistantAvatar v-if="!opened" :appearance="user.avatarAppearance" size="large" />
      <i v-else class="bi bi-chevron-down" aria-hidden="true"></i>
      <span v-if="!opened" class="assistant-sparkle" aria-hidden="true"><i class="bi bi-stars"></i></span>
    </button>
  </div>
</template>

<style scoped>
.assistant-widget { position: fixed; right: 26px; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); z-index: 1030; display: flex; flex-direction: column; align-items: flex-end; gap: 14px; }
.assistant-launcher { position: relative; display: grid; place-items: center; width: 76px; height: 76px; padding: 0; border: 3px solid var(--theme-panel, #fff); border-radius: 50%; background: #2d7d43; color: #fff; box-shadow: 0 6px 24px #234d3733, 0 2px 6px #234d371a; transition: transform .18s, box-shadow .18s; }
.assistant-launcher:hover { transform: translateY(-3px); box-shadow: 0 10px 28px #234d3740; }
.assistant-launcher:focus-visible { outline: 3px solid #398663; outline-offset: 4px; }
.assistant-launcher.is-open { width: 60px; height: 60px; font-size: 23px; }
.assistant-sparkle { position: absolute; right: -2px; bottom: 0; width: 24px; height: 24px; display: grid; place-items: center; border: 2px solid var(--theme-panel, white); border-radius: 50%; background: #2d7d43; color: white; font-size: 12px; }
.assistant-panel { width: min(390px, calc(100vw - 32px)); max-height: calc(100dvh - 130px); overflow: auto; border: 1px solid var(--theme-border, #e4ece5); border-radius: 22px; background: var(--theme-panel, #fff); color: var(--theme-text, #21312c); box-shadow: 0 12px 50px #243a322b; }
.assistant-header { display: flex; align-items: center; gap: 12px; padding: 18px; border-bottom: 1px solid var(--theme-border, #e4ece5); }
.assistant-header h2 { font-size: 16px; font-weight: 750; margin: 0 0 3px; }
.assistant-header p { font-size: 12px; color: var(--theme-muted, #6d7b75); margin: 0; }
.assistant-minimize { margin-left: auto; border: 0; background: none; color: var(--theme-muted, #6d7b75); border-radius: 8px; width: 32px; height: 32px; flex-shrink: 0; }
.assistant-welcome { padding: 32px 26px; text-align: center; }
.assistant-welcome h3 { font-size: 19px; font-weight: 700; margin: 20px 0 10px; }
.assistant-welcome p { font-size: 14px; line-height: 1.6; color: var(--theme-muted, #6d7b75); }
.assistant-status { display: inline-block; padding: 6px 12px; background: var(--theme-soft, #eef6ef); color: var(--theme-green, #246e58); border-radius: 20px; font-size: 12px; font-weight: 600; }
@media(max-width: 767px) { .assistant-widget { right: 16px; bottom: calc(88px + env(safe-area-inset-bottom, 0px)); } .assistant-panel { max-height: calc(100dvh - 200px); } .assistant-launcher { width: 64px; height: 64px; } .assistant-launcher :deep(.assistant-avatar--large) { width: 58px; height: 58px; } }
@media(prefers-reduced-motion: reduce) { .assistant-launcher { transition: none; } }
</style>
