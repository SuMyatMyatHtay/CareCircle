<script setup>
import { ref, nextTick, watch, computed } from 'vue'
import AssistantAvatar from './AssistantAvatar.vue'
import AssistantTaskPreview from '../../assistant/components/AssistantTaskPreview.vue'
import { useAssistantChat } from '../../assistant/composables/useAssistantChat.js'
const props = defineProps({ user: { type: Object, default: () => ({}) } })
const opened = ref(false), launcher = ref(null), closeButton = ref(null), thread = ref(null)
const chat = useAssistantChat(computed(() => props.user))
const { messages, input, busy, error, retryable, canSend, selectedFamilyId, selectedFamily } = chat
const starters = ['What tasks are coming up this week?', 'Help me add a task', 'I want to update a task']
const dateLabel = date => new Date(date).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
watch([messages, busy, error, opened], async () => {
  await nextTick()
  if (thread.value) thread.value.scrollTop = thread.value.scrollHeight
}, { deep: true })
function chooseTask(task) { chat.send(`I want to update this task: ${task.title} (task ID: ${task.id}, starting ${task.startAt}). Ask me what to change.`) }
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
    <!-- Grows out of the launcher button (transform-origin: bottom right) -->
    <Transition name="care-grow">
    <section v-if="opened" id="carecircle-assistant-panel" class="assistant-panel" role="region" aria-label="CareCircle assistant">
      <header class="assistant-header">
        <AssistantAvatar :appearance="user.avatarAppearance" />
        <div class="assistant-heading"><h2>CareCircle assistant</h2><p>{{ selectedFamily ? `Helping the ${selectedFamily.name}` : 'Your personal care companion' }}</p></div>
        <button type="button" class="assistant-minimize" aria-label="Start a new chat" title="Start a new chat" :disabled="busy" @click="chat.reset"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i></button>
        <button ref="closeButton" type="button" class="assistant-minimize" aria-label="Minimize assistant" @click="toggle"><i class="bi bi-dash-lg" aria-hidden="true"></i></button>
      </header>
      <div ref="thread" class="assistant-thread" role="log" aria-label="Assistant conversation" aria-live="polite" :aria-busy="busy">
        <div v-if="!messages.length" class="assistant-welcome">
          <AssistantAvatar :appearance="user.avatarAppearance" size="large" />
          <h3>A little help for your circle</h3>
          <p>{{ selectedFamilyId ? 'Find a task, plan an appointment or change your plans. Just tell me what you need.' : 'Join or select a family to start chatting.' }}</p>
          <div v-if="selectedFamilyId" class="assistant-starters"><button v-for="starter in starters" :key="starter" type="button" :disabled="busy" @click="chat.send(starter)">{{ starter }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></button></div>
        </div>
        <!-- New messages fade up into the thread; ones already there don't replay when it opens -->
        <TransitionGroup name="care-list" tag="div" class="assistant-messages">
        <div v-for="(message, index) in messages" :key="index" class="assistant-message" :class="`assistant-message--${message.role}`">
          <p class="assistant-bubble">{{ message.content }}</p>
          <div v-if="message.tasks?.length" class="assistant-results"><button v-for="task in message.tasks" :key="task.id" type="button" :disabled="busy" @click="chooseTask(task)"><strong>{{ task.title }}</strong><span>{{ task.recipientName }} &middot; {{ dateLabel(task.startAt) }}</span><small>{{ task.location?.name || 'No location' }} &middot; {{ task.status.replaceAll('_', ' ') }}</small></button><p v-if="message.hasMore" class="assistant-more">Showing the first 10 matches. Add a date or keyword to narrow the search.</p></div>
          <AssistantTaskPreview v-if="message.proposal" :proposal="message.proposal" :state="message.proposalState" :busy="busy" @confirm="chat.confirm(message)" @dismiss="chat.dismiss(message)" />
          <div v-if="index === messages.length - 1 && !busy && message.suggestions?.length" class="assistant-suggestions"><button v-for="suggestion in message.suggestions" :key="suggestion" type="button" @click="chat.send(suggestion)">{{ suggestion }}</button></div>
        </div>
        </TransitionGroup>
        <div v-if="busy" class="assistant-thinking" role="status"><span class="assistant-dot"></span><span class="assistant-dot"></span><span class="assistant-dot"></span><span class="assistant-dots-static" aria-hidden="true">…</span><span class="visually-hidden">Working on it...</span><button type="button" class="assistant-stop" @click="chat.stop">Stop waiting</button></div>
        <div v-if="error" class="assistant-error" role="alert">{{ error }}<button v-if="retryable" type="button" :disabled="busy" @click="chat.retry">Try again</button></div>
      </div>
      <footer class="assistant-composer">
        <form @submit.prevent="chat.send()">
          <input v-model="input" type="text" aria-label="Message CareCircle assistant" placeholder="Tell me what you need..." maxlength="2000" :disabled="busy || !selectedFamilyId" />
          <button type="submit" :disabled="!canSend" aria-label="Send message"><i class="bi bi-send" aria-hidden="true"></i></button>
        </form>
        <p>Nothing is saved until you confirm. The assistant can make mistakes.</p>
        <details><summary>Powered by Gemini</summary><p>Your messages and relevant family task details are sent to Google Gemini. Chat history clears when you switch families or start a new chat.</p></details>
      </footer>
    </section>
    </Transition>
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
.assistant-panel { transform-origin: bottom right; display: flex; flex-direction: column; height: min(640px, calc(100dvh - 130px)); width: min(410px, calc(100vw - 32px)); max-height: calc(100dvh - 130px); overflow: auto; border: 1px solid var(--theme-border, #e4ece5); border-radius: 22px; background: var(--theme-panel, #fff); color: var(--theme-text, #21312c); box-shadow: 0 12px 50px #243a322b; }
.assistant-header { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 18px; border-bottom: 1px solid var(--theme-border, #e4ece5); }
.assistant-header h2 { font-size: 16px; font-weight: 750; margin: 0 0 3px; }
.assistant-header p { font-size: 12px; color: var(--theme-muted, #6d7b75); margin: 0; }
.assistant-heading { min-width: 0; flex: 1; }
.assistant-minimize { border: 0; background: none; color: var(--theme-muted, #6d7b75); border-radius: 8px; width: 32px; height: 32px; flex-shrink: 0; }
.assistant-welcome { padding: 32px 26px; text-align: center; }
.assistant-welcome h3 { font-size: 19px; font-weight: 700; margin: 20px 0 10px; }
.assistant-welcome p { font-size: 14px; line-height: 1.6; color: var(--theme-muted, #6d7b75); }
.assistant-status { display: inline-block; padding: 6px 12px; background: var(--theme-soft, #eef6ef); color: var(--theme-green, #246e58); border-radius: 20px; font-size: 12px; font-weight: 600; }
@media(max-width: 767px) { .assistant-widget { right: 16px; bottom: calc(88px + env(safe-area-inset-bottom, 0px)); } .assistant-panel { max-height: calc(100dvh - 200px); } .assistant-launcher { width: 64px; height: 64px; } .assistant-launcher :deep(.assistant-avatar--large) { width: 58px; height: 58px; } }
@media(prefers-reduced-motion: reduce) { .assistant-launcher { transition: none; } }
.assistant-thread { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 18px; background: var(--theme-page, #fafcf9); }
.assistant-welcome { padding: 14px 4px 20px; }
.assistant-starters { display: grid; gap: 8px; margin-top: 20px; }
.assistant-starters button { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid var(--theme-border, #e4ece5); border-radius: 12px; background: var(--theme-panel, white); color: var(--theme-text, #21312c); padding: 12px; font-size: 12px; text-align: left; }
.assistant-message { margin-bottom: 16px; }
.assistant-bubble { width: fit-content; max-width: 92%; padding: 12px 14px; margin: 0; border: 1px solid var(--theme-border, #e4ece5); border-radius: 17px 17px 17px 4px; font-size: 13px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--theme-panel, white); }
.assistant-message--user { display: flex; justify-content: flex-end; }
.assistant-message--user .assistant-bubble { border-radius: 17px 17px 4px 17px; background: #2d7d43; border-color: #2d7d43; color: white; }
.assistant-suggestions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.assistant-suggestions button { border: 1px solid var(--theme-accent-border, #b9d6c0); background: var(--theme-soft, #eef6ef); color: var(--theme-green, #246e58); border-radius: 20px; padding: 7px 11px; font-size: 12px; }
.assistant-results { display: grid; gap: 8px; margin-top: 10px; }
.assistant-results button { text-align: left; padding: 12px; border: 1px solid var(--theme-border, #e4ece5); border-radius: 13px; background: var(--theme-panel, white); color: inherit; }
.assistant-results strong, .assistant-results span, .assistant-results small { display: block; }
.assistant-results strong { font-size: 13px; } .assistant-results span { font-size: 12px; margin-top: 4px; } .assistant-results small, .assistant-more { font-size: 11px; color: var(--theme-muted, #6d7b75); }
.assistant-composer { flex-shrink: 0; padding: 14px 16px; border-top: 1px solid var(--theme-border, #e4ece5); }
.assistant-composer form { display: flex; gap: 8px; }
.assistant-composer input { flex: 1; min-width: 0; padding: 12px; border: 1px solid var(--theme-border, #dce7df); border-radius: 12px; background: var(--theme-panel, white); color: inherit; font-size: 13px; }
.assistant-composer form button { width: 44px; border: 0; border-radius: 12px; background: #2d7d43; color: white; }
.assistant-composer p { margin: 9px 0 0; font-size: 10px; line-height: 1.4; color: var(--theme-muted, #6d7b75); }
.assistant-composer details { margin-top: 5px; font-size: 10px; color: var(--theme-muted, #6d7b75); }
.assistant-error { padding: 12px; border-radius: 12px; background: var(--theme-danger-soft, #fff0ed); color: var(--theme-danger, #a94442); font-size: 12px; }
.assistant-error button { display: block; margin-top: 8px; border: 0; background: none; color: inherit; text-decoration: underline; padding: 0; }
.assistant-thinking { display: flex; align-items: center; gap: 4px; padding: 14px; }
.assistant-dot { width: 6px; height: 6px; border-radius: 50%; background: #6d9c79; animation: assistant-pulse 1.2s ease-in-out infinite; }
.assistant-dot:nth-child(2) { animation-delay: .2s; } .assistant-dot:nth-child(3) { animation-delay: .4s; }
.assistant-dots-static { display: none; color: #6d9c79; font-weight: 700; }
@keyframes assistant-pulse { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
.assistant-messages { position: relative; }
@media(prefers-reduced-motion: reduce) { .assistant-dot { display: none; } .assistant-dots-static { display: inline; } }
button:disabled { opacity: .5; cursor: default; }
.assistant-stop { margin-left: auto; border: 0; background: none; color: var(--theme-muted, #6d7b75); font-size: 11px; text-decoration: underline; }
@media(max-width: 767px) { .assistant-panel { height: min(590px, calc(100dvh - 200px)); } }
</style>
