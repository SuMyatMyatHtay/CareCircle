<script setup>
import { ref, computed } from 'vue'
import AuthShell from '../components/AuthShell.vue'
const name = ref('')
const email = ref('')
const phone = ref('')
const preferredLang = ref('en')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const agreed = ref(false)
const attempted = ref(false)
const notice = ref('')
const validEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const validPassword = computed(() => password.value.length >= 8)
const validConfirm = computed(() => confirmPassword.value === password.value && !!confirmPassword.value)
function previewSubmit() {
  attempted.value = true
  notice.value =
    name.value.trim() && validEmail.value && validPassword.value && validConfirm.value && agreed.value
      ? 'Your details are ready! Account creation will work once the Express API is connected.'
      : ''
}
</script>
<template>
  <AuthShell>
    <div class="auth-icon" aria-hidden="true">✿</div>
    <div class="auth-eyebrow">JOIN OUR CIRCLE</div>
    <h2>Let's care together!</h2>
    <p class="auth-subtitle">Create your account to join or start a family circle. ♡</p>
    <form @submit.prevent="previewSubmit" novalidate>
      <div class="form-group">
        <label for="name">Full name <span class="required">*</span></label>
        <div class="input-wrap">
          <i class="bi bi-person"></i
          ><input
            id="name"
            v-model.trim="name"
            autocomplete="name"
            placeholder="e.g. Jasmine Tan"
            :aria-invalid="attempted && !name"
          />
        </div>
        <p v-if="attempted && !name" class="field-error">Please enter your name.</p>
      </div>
      <div class="form-group">
        <label for="email">Email address <span class="required">*</span></label>
        <div class="input-wrap">
          <i class="bi bi-envelope"></i
          ><input
            id="email"
            v-model.trim="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            :aria-invalid="attempted && !validEmail"
          />
        </div>
        <p v-if="attempted && !validEmail" class="field-error">Enter a valid email address.</p>
      </div>
      <div class="form-pair">
        <div class="form-group">
          <label for="phone">Phone <span class="optional">optional</span></label>
          <div class="input-wrap">
            <i class="bi bi-phone"></i
            ><input id="phone" v-model.trim="phone" autocomplete="tel" type="tel" placeholder="+65 9123 4567" />
          </div>
        </div>
        <div class="form-group">
          <label for="language">Language</label>
          <div class="input-wrap">
            <i class="bi bi-translate"></i
            ><select id="language" v-model="preferredLang">
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ms">Bahasa Melayu</option>
              <option value="ta">தமிழ்</option>
            </select>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label for="password">Password <span class="required">*</span></label>
        <div class="input-wrap">
          <i class="bi bi-lock"></i
          ><input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="At least 8 characters"
            :aria-invalid="attempted && !validPassword"
          /><button
            type="button"
            class="reveal"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
          >
            <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
          </button>
        </div>
        <p v-if="attempted && !validPassword" class="field-error">Use at least 8 characters.</p>
      </div>
      <div class="form-group">
        <label for="confirm">Confirm password <span class="required">*</span></label>
        <div class="input-wrap">
          <i class="bi bi-shield-lock"></i
          ><input
            id="confirm"
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="Enter password again"
            :aria-invalid="attempted && !validConfirm"
          />
        </div>
        <p v-if="attempted && !validConfirm" class="field-error">Passwords must match.</p>
      </div>
      <label class="check-row"
        ><input v-model="agreed" type="checkbox" />
        <span>I understand this is a care coordination platform and agree to the app's terms.</span></label
      >
      <p v-if="attempted && !agreed" class="field-error">Please tick the box to continue.</p>
      <button class="auth-submit" type="submit">Create account <i class="bi bi-arrow-right"></i></button>
      <p v-if="notice" class="auth-notice" role="status">{{ notice }}</p>
    </form>
    <p class="auth-bottom">Already part of our circle? <RouterLink to="/login">Log in here</RouterLink></p>
    <div class="auth-preview">
      <span class="preview-tag">NEXT STEP</span><span>After registration, show the Create or Join Family page.</span
      ><RouterLink to="/join-family">Preview family setup →</RouterLink>
    </div>
  </AuthShell>
</template>
