<script setup>
// Owner: Chaithra (E)
// "Connect Google Calendar" on My Tasks. After connecting once, the server keeps the
// person's Google Calendar in step with their claimed tasks by itself (like Zoom does).
// Hidden when the server isn't set up for Google (no GOOGLE_* lines in server/.env).
//   <GoogleCalendarSync compact />  (compact = smaller, for the phone layout)
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGoogleStatus, connectGoogle, syncGoogleNow, disconnectGoogle } from '../services/googleCalendarApi.js'
import { getErrorMessage } from '../services/myTasksApi.js'
import { formatTime } from '../utils/formatters.js'

defineProps({
    compact: { type: Boolean, default: false }
})
const emit = defineEmits(['synced'])

const route = useRoute()
const router = useRouter()
const status = ref(null)
const busy = ref(false)
const message = ref('')
const isError = ref(false)
const menuOpen = ref(false)

const syncedText = computed(() =>
    status.value?.lastSyncedAt ? `Synced ${formatTime(status.value.lastSyncedAt)}` : 'Syncing…'
)

function say(text, error = false) {
    message.value = text
    isError.value = error
}

async function load() {
    try {
        status.value = await getGoogleStatus()
    } catch {
        status.value = null // hide the card if the server can't tell
    }
}

async function connect() {
    busy.value = true
    try {
        await connectGoogle() // leaves the page
    } catch (error) {
        say(getErrorMessage(error), true)
        busy.value = false
    }
}

async function syncNow() {
    busy.value = true
    menuOpen.value = false
    try {
        const result = await syncGoogleNow()
        await load()
        if (!result.connected) say('Google Calendar was disconnected. Connect it again to keep syncing.', true)
        else say('Google Calendar is up to date.')
        emit('synced')
    } catch (error) {
        say(getErrorMessage(error), true)
    } finally {
        busy.value = false
    }
}

async function disconnect() {
    menuOpen.value = false
    const removeEvents = window.confirm(
        'Stop syncing with Google Calendar?\n\nOK: also remove the CareCircle events from your calendar\nCancel: keep them'
    )
    busy.value = true
    try {
        await disconnectGoogle({ removeEvents })
        await load()
        say('Google Calendar disconnected.')
    } catch (error) {
        say(getErrorMessage(error), true)
    } finally {
        busy.value = false
    }
}

onMounted(async () => {
    await load()
    // Back from Google's page: /my-tasks?calendar=connected|cancelled|error
    const result = route.query.calendar
    if (result) {
        if (result === 'connected') say('Connected! Your tasks are now in Google Calendar and will stay in sync.')
        else if (result === 'cancelled') say('Google Calendar was not connected.')
        else say('Could not connect Google Calendar. Please try again.', true)
        router.replace({ query: { ...route.query, calendar: undefined } })
    }
})
</script>

<template>
    <div v-if="status?.available" class="gsync" :class="{ compact }">
        <!-- Not connected yet -->
        <button v-if="!status.connected" type="button" class="gsync-connect" :disabled="busy" @click="connect">
            <i class="bi bi-google" aria-hidden="true"></i>
            <span>
                <strong>Connect Google Calendar</strong>
                <small v-if="!compact">Your tasks appear in it automatically</small>
            </span>
        </button>

        <!-- Connected -->
        <div v-else class="gsync-on">
            <i class="bi bi-check-circle-fill" aria-hidden="true"></i>
            <span class="gsync-text">
                <strong>Google Calendar on</strong>
                <small :title="status.email">{{ status.lastError ? 'Last sync failed' : syncedText }}</small>
            </span>
            <span class="gsync-menu">
                <button type="button" class="gsync-more" aria-label="Google Calendar options" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
                    <i class="bi bi-three-dots" aria-hidden="true"></i>
                </button>
                <span v-if="menuOpen" class="gsync-pop">
                    <small v-if="status.email" class="gsync-email">{{ status.email }}</small>
                    <button type="button" :disabled="busy" @click="syncNow">Sync now</button>
                    <button type="button" class="danger" :disabled="busy" @click="disconnect">Disconnect</button>
                </span>
            </span>
        </div>

        <p v-if="message" class="gsync-msg" :class="{ 'is-error': isError }" role="status" @click="message = ''">
            {{ message }}
        </p>
    </div>
</template>

<style scoped>
.gsync {
    position: relative;
    font-family: inherit;
}

.gsync-connect,
.gsync-on {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: white;
    font-family: inherit;
    text-align: left;
    color: #2e2e2e;
}

.gsync-connect:hover {
    border-color: #2f7a3f;
    background: #f6fbf6;
}

.gsync-connect .bi-google {
    font-size: 18px;
    color: #1a73e8;
}

.gsync-connect span,
.gsync-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
}

.gsync strong {
    font-size: 14px;
    font-weight: 700;
}

.gsync small {
    font-size: 12px;
    color: #6b7280;
}

.gsync-on {
    border-color: #cfe8d3;
    background: #e8f5e9;
}

.gsync-on > .bi {
    font-size: 18px;
    color: #2f7a3f;
}

.gsync-menu {
    position: relative;
    margin-left: auto;
}

.gsync-more {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #2f7a3f;
}

.gsync-more:hover {
    background: rgba(47, 122, 63, 0.1);
}

.gsync-pop {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    padding: 6px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: white;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.gsync-email {
    padding: 6px 10px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.gsync-pop button {
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: white;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    color: #2e2e2e;
    text-align: left;
}

.gsync-pop button:hover {
    background: #f3f4f6;
}

.gsync-pop .danger {
    color: #a33a26;
}

.gsync-msg {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 15;
    width: max-content;
    max-width: 320px;
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: #e8f5e9;
    font-size: 13px;
    color: #1f5a2c;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    cursor: pointer;
}

.gsync-msg.is-error {
    background: #ffe9e4;
    color: #9f3a2b;
}

/* Phone */
.compact .gsync-connect,
.compact .gsync-on {
    width: 100%;
    padding: 10px 14px;
    border-radius: 14px;
}

.compact .gsync-msg {
    position: static;
    width: auto;
    max-width: none;
    margin-top: 8px;
}

.compact .gsync-pop {
    right: 0;
}
</style>
