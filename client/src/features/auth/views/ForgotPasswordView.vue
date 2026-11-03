<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '../components/AuthShell.vue'
import { requestPasswordReset, verifyResetCode, resetPassword } from '../services/authApi.js'

const email = ref(''), code = ref(''), password = ref(''), confirmPassword = ref('')
const route = useRoute(), router = useRouter(), resetToken = ref(''), done = ref(false)
const step = computed(() => done.value ? 'done' : route.path.endsWith('/new-password') ? 'reset' : route.path.endsWith('/verify') ? 'verify' : 'email')
function guardStep() {
  if ((step.value === 'verify' && !email.value) || (step.value === 'reset' && !resetToken.value)) void router.replace('/forgot-password')
}
onMounted(guardStep)
watch(() => route.path, guardStep)
const busy = ref(false), error = ref(''), message = ref(''), cooldown = ref(0)
let timer
onBeforeUnmount(() => clearInterval(timer))
function startCooldown() {
  cooldown.value = 60
  clearInterval(timer)
  timer = setInterval(() => { if (--cooldown.value <= 0) clearInterval(timer) }, 1000)
}
async function sendCode() {
  if (busy.value || cooldown.value) return
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { error.value = 'Enter a valid email address.'; return }
  busy.value = true; error.value = ''; message.value = ''
  try {
    const result = await requestPasswordReset(email.value.trim())
    message.value = result.message
    code.value = ''; resetToken.value = ''; startCooldown(); await router.push('/forgot-password/verify')
  } catch (err) { error.value = err.response?.data?.message || 'Unable to request a code. Please try again.' }
  finally { busy.value = false }
}
async function submitCode() {
  if (busy.value) return
  error.value = ''; message.value = ''
  if (!/^\d{6}$/.test(code.value)) { error.value = 'Enter the six-digit code.'; return }
  busy.value = true
  try {
    const result = await verifyResetCode(email.value.trim(), code.value)
    resetToken.value = result.resetToken; code.value = ''; message.value = result.message
    await router.push('/forgot-password/new-password')
  } catch (err) { error.value = err.response?.data?.message || 'Unable to verify your code. Please try again.' }
  finally { busy.value = false }
}
async function submitReset() {
  if (busy.value) return
  error.value = ''; message.value = ''
  if (password.value.length < 8 || password.value.length > 128 || password.value !== confirmPassword.value) {
    error.value = 'Enter matching passwords of 8–128 characters.'; return
  }
  busy.value = true
  try {
    const result = await resetPassword(email.value.trim(), resetToken.value, password.value, confirmPassword.value)
    message.value = result.message; done.value = true; resetToken.value = ''
    code.value = ''; password.value = ''; confirmPassword.value = ''; clearInterval(timer)
  } catch (err) { error.value = err.response?.data?.message || 'Unable to reset your password. Please try again.' }
  finally { busy.value = false }
}
function changeEmail() {
  void router.push('/forgot-password'); resetToken.value = ''; done.value = false; code.value = ''; password.value = ''; confirmPassword.value = ''
  error.value = ''; message.value = ''
}
</script>

<template>
  <AuthShell>
    <div class="auth-eyebrow">ACCOUNT RECOVERY</div>
    <h2>{{ step === 'done' ? 'Password updated' : step === 'verify' ? 'Verify your code' : step === 'reset' ? 'Choose a new password' : 'Forgot your password?' }}</h2>
    <p class="auth-subtitle">{{ step === 'email' ? 'We’ll email you a six-digit code to reset your password.' : step === 'verify' ? `Enter the code for ${email}. It expires in 10 minutes.` : step === 'reset' ? 'Code verified. Choose your new password within five minutes.' : 'You can now log in with your new password.' }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
    <form v-if="step === 'email'" @submit.prevent="sendCode">
      <div class="form-group">
        <label for="reset-email">Email address</label>
        <div class="input-wrap"><input id="reset-email" v-model.trim="email" type="email" autocomplete="email" maxlength="254" required :disabled="busy" /></div>
      </div>
      <button class="auth-submit" :disabled="busy || cooldown > 0">{{ busy ? 'Sending…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send reset code' }}</button>
    </form>
    <form v-else-if="step === 'verify'" @submit.prevent="submitCode">
      <div class="form-group">
        <label for="reset-code">Six-digit code</label>
        <div class="input-wrap"><input id="reset-code" v-model.trim="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required :disabled="busy" /></div>
      </div>
      <button class="auth-submit" :disabled="busy">{{ busy ? 'Verifying...' : 'Verify code' }}</button>
      <div class="reset-actions">
        <button type="button" :disabled="busy || cooldown > 0" @click="sendCode">{{ cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code' }}</button>
        <button type="button" :disabled="busy" @click="changeEmail">Change email</button>
      </div>
    </form>
    <form v-else-if="step === 'reset'" @submit.prevent="submitReset">
      <div class="form-group">
        <label for="new-password">New password</label>
        <div class="input-wrap"><input id="new-password" v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required :disabled="busy" /></div>
        <small>Use 8–128 characters.</small>
      </div>
      <div class="form-group">
        <label for="confirm-new-password">Confirm new password</label>
        <div class="input-wrap"><input id="confirm-new-password" v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required :disabled="busy" /></div>
      </div>
      <button class="auth-submit" :disabled="busy">{{ busy ? 'Resetting…' : 'Reset password' }}</button>
      <button type="button" :disabled="busy" @click="changeEmail">Start again</button>
    </form>
    <RouterLink to="/login" class="auth-alternate">Back to login</RouterLink>
  </AuthShell>
</template>

<style scoped>
.reset-actions { display: flex; justify-content: space-between; gap: 12px; margin: 16px 0; }
.reset-actions button { background: none; border: 0; color: var(--theme-green, #2d7d43); text-decoration: underline; }
.reset-actions button:disabled { opacity: .5; }
</style>
