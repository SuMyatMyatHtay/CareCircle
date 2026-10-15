<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '../components/AuthShell.vue'
import { registerCaregiver, registrationErrorMessage } from '../services/registerApi.js'
import { clearUserSession } from '../services/authApi.js'

const router = useRouter()
const name = ref('')
const email = ref('')
const phone = ref('')
const preferredLang = ref('en')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const agreed = ref(false)
const attempted = ref(false)
const loading = ref(false)
const error = ref('')
const validName = computed(() => name.value.trim().length >= 2 && name.value.trim().length <= 80)
const validEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const validPassword = computed(() => password.value.length >= 8 && password.value.length <= 128)
const validConfirm = computed(() => confirmPassword.value === password.value && !!confirmPassword.value)

async function handleSignup() {
  attempted.value = true
  error.value = ''
  if (!validName.value || !validEmail.value || !validPassword.value || !validConfirm.value || !agreed.value) return
  if (loading.value) return
  loading.value = true
  try {
    const response = await registerCaregiver({
      name: name.value.trim(), email: email.value.trim(), phone: phone.value.trim(),
      preferredLang: preferredLang.value, password: password.value,
      confirmPassword: confirmPassword.value, agreed: agreed.value
    })
    clearUserSession()
    sessionStorage.setItem('token', response.token)
    sessionStorage.setItem('user', JSON.stringify(response.user))
    await router.replace('/home')
  } catch (e) {
    error.value = registrationErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell>
    <div class="auth-icon" aria-hidden="true">✿</div>
    <div class="auth-eyebrow">JOIN OUR CIRCLE</div>
    <h2>Let's care together!</h2>
    <p class="auth-subtitle">Create your caregiver account to join or start a family circle. ♡</p>
    <form @submit.prevent="handleSignup" novalidate>
      <div class="form-group">
        <label for="name">Full name <span class="required">*</span></label>
        <div class="input-wrap"><i class="bi bi-person"></i><input id="name" v-model.trim="name" autocomplete="name" maxlength="80" placeholder="e.g. Jasmine Tan" :disabled="loading" :aria-invalid="attempted && !validName" /></div>
        <p v-if="attempted && !validName" class="field-error">Enter a name between 2 and 80 characters.</p>
      </div>
      <div class="form-group">
        <label for="email">Email address <span class="required">*</span></label>
        <div class="input-wrap"><i class="bi bi-envelope"></i><input id="email" v-model.trim="email" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com" :disabled="loading" :aria-invalid="attempted && !validEmail" /></div>
        <p v-if="attempted && !validEmail" class="field-error">Enter a valid email address.</p>
      </div>
      <div class="form-pair">
        <div class="form-group">
          <label for="phone">Phone <span class="optional">optional</span></label>
          <div class="input-wrap"><i class="bi bi-phone"></i><input id="phone" v-model.trim="phone" autocomplete="tel" type="tel" maxlength="30" placeholder="+65 9123 4567" :disabled="loading" /></div>
        </div>
        <div class="form-group">
          <label for="language">Language</label>
          <div class="input-wrap"><i class="bi bi-translate"></i><select id="language" v-model="preferredLang" :disabled="loading"><option value="en">English</option><option value="zh">中文</option><option value="ms">Bahasa Melayu</option><option value="ta">தமிழ்</option></select></div>
        </div>
      </div>
      <div class="form-group">
        <label for="password">Password <span class="required">*</span></label>
        <div class="input-wrap"><i class="bi bi-lock"></i><input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" maxlength="128" placeholder="At least 8 characters" :disabled="loading" :aria-invalid="attempted && !validPassword" /><button type="button" class="reveal" @click="showPassword = !showPassword" :aria-label="showPassword ? 'Hide password' : 'Show password'"><i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i></button></div>
        <p v-if="attempted && !validPassword" class="field-error">Use 8–128 characters.</p>
      </div>
      <div class="form-group">
        <label for="confirm">Confirm password <span class="required">*</span></label>
        <div class="input-wrap"><i class="bi bi-shield-lock"></i><input id="confirm" v-model="confirmPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="Enter password again" :disabled="loading" :aria-invalid="attempted && !validConfirm" /></div>
        <p v-if="attempted && !validConfirm" class="field-error">Passwords must match.</p>
      </div>
      <label class="check-row"><input v-model="agreed" type="checkbox" :disabled="loading" /><span>I understand this is a care coordination platform and agree to the app's terms.</span></label>
      <p v-if="attempted && !agreed" class="field-error">Please tick the box to continue.</p>
      <p v-if="error" class="auth-error" role="alert"><i class="bi bi-exclamation-circle me-1"></i>{{ error }}</p>
      <button class="auth-submit" type="submit" :disabled="loading"><template v-if="loading"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Creating account...</template><template v-else>Create account <i class="bi bi-arrow-right"></i></template></button>
    </form>
    <p class="auth-bottom">Already part of our circle? <RouterLink to="/login">Log in here</RouterLink></p>
  </AuthShell>
</template>
