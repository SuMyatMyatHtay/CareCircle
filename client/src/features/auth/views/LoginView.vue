<script setup>
import { ref, computed } from 'vue'
import AuthShell from '../components/AuthShell.vue'
const email=ref('')
const password=ref('')
const showPassword=ref(false)
const attempted=ref(false)
const message=ref('')
const emailValid=computed(()=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
function previewSubmit(){
 attempted.value=true
 message.value = emailValid.value && password.value ? 'The form looks good! Authentication will become available when the Express API is connected.' : ''
}
</script>
<template>
  <AuthShell>
    <div class="auth-icon" aria-hidden="true">♥</div>
    <div class="auth-eyebrow">WELCOME BACK</div>
    <h2>Lovely to see you again!</h2>
    <p class="auth-subtitle">Log in to your family circle and keep the care going. ♡</p>
    <form @submit.prevent="previewSubmit" novalidate>
      <div class="form-group"><label for="email">Email address</label><div class="input-wrap"><i class="bi bi-envelope" aria-hidden="true"></i><input id="email" v-model.trim="email" type="email" autocomplete="email" placeholder="you@example.com" :aria-invalid="attempted && !emailValid" /></div><p v-if="attempted && !emailValid" class="field-error">Enter a valid email address.</p></div>
      <div class="form-group"><div class="label-row"><label for="password">Password</label><span class="coming-soon">Forgot password? · Later</span></div><div class="input-wrap"><i class="bi bi-lock" aria-hidden="true"></i><input id="password" v-model="password" :type="showPassword?'text':'password'" autocomplete="current-password" placeholder="Enter your password" :aria-invalid="attempted && !password" /><button class="reveal" type="button" @click="showPassword=!showPassword" :aria-label="showPassword?'Hide password':'Show password'"><i :class="showPassword?'bi bi-eye-slash':'bi bi-eye'"></i></button></div><p v-if="attempted && !password" class="field-error">Password is required.</p></div>
      <button class="auth-submit" type="submit">Log in <i class="bi bi-arrow-right"></i></button>
      <p v-if="message" class="auth-notice" role="status">{{message}}</p>
    </form>
    <div class="auth-divider"><span>or</span></div>
    <RouterLink to="/signup" class="auth-alternate">Create an account <i class="bi bi-arrow-up-right"></i></RouterLink>
    <p class="auth-bottom">New to CareCircle? Welcome to the family! 🌷</p>
    <div class="auth-preview"><span class="preview-tag">UI PREVIEW</span><span>Want to browse the existing sample pages?</span><RouterLink to="/family">Enter demo family →</RouterLink></div>
  </AuthShell>
</template>
