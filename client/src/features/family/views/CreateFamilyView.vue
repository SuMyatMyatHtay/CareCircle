
<script setup>
import { ref, computed } from 'vue'
import {
  createFamily,
  getFamilyErrorMessage
} from '../services/familyApi.js'
import '../../../styles/createFamilyView.css'

const familyName = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const createdFamily = ref(null)

const isValid = computed(() => {
  const name = familyName.value.trim()

  return name.length >= 2 &&
    name.length <= 80 &&
    !isLoading.value
})

async function handleCreateFamily() {
  errorMessage.value = ''

  // 1. Validate family name
  if (!isValid.value) {
    errorMessage.value = 'Please enter a valid family name.'
    return
  }

  // 2. Start loading
  isLoading.value = true

  try {
    // 3. Call backend
    const response = await createFamily(
      familyName.value.trim()
    )

    // 4. Validate response
    if (
      response.success !== true ||
      !response.family?.id ||
      !response.family?.inviteCode
    ) {
      throw new Error('Unexpected server response.')
    }

    // 5. Show success screen
    createdFamily.value = response.family

  } catch (error) {
    errorMessage.value = getFamilyErrorMessage(error)

  } finally {
    isLoading.value = false
  }
}

async function copyInviteCode() {
  try {
    await navigator.clipboard.writeText(
      createdFamily.value.inviteCode
    )
  } catch {
    errorMessage.value = 'Unable to copy. Please select the code manually.'
  }
}
</script>

<template>
  <main class="create-family-page">
    <RouterLink to="/home" class="back-link">
      ← Back to home
    </RouterLink>

    <section class="family-card">
      <div class="family-art">🏡🌷</div>
      <div class="eyebrow">♡ CARE STARTS HERE ♡</div>

      <!-- CREATE FORM -->
      <template v-if="!createdFamily">
        <h1>Let's start your little circle!</h1>

        <p class="subtitle">
          Give your family a special name.
          Together, we'll make caring easier! ♡
        </p>

        <form @submit.prevent="handleCreateFamily">
          <label for="familyName">
            What should we call your family?
          </label>

          <input
            id="familyName"
            v-model="familyName"
            type="text"
            placeholder="e.g. Tan Family"
            maxlength="80"
            :disabled="isLoading"
          />

          <p class="hint">
            {{ familyName.trim().length }}/80 characters
          </p>

          <p v-if="errorMessage" class="error" role="alert">
            {{ errorMessage }}
          </p>

          <button
            type="submit"
            :disabled="!isValid"
          >
            {{ isLoading ? 'Creating your circle...' : 'Create my family ♡' }}
          </button>
        </form>
      </template>

      <!-- SUCCESS SCREEN -->
      <template v-else>
        <div class="success-art">🎉</div>

        <h1>Your circle is ready!</h1>

        <p class="subtitle">
          <strong>{{ createdFamily.name }}</strong>
          has been created successfully.
          You're the first member and family admin!
        </p>

        <div class="invite-code-card">
          <p>YOUR FAMILY INVITE CODE</p>

          <h2>{{ createdFamily.inviteCode }}</h2>

          <button
            type="button"
            @click="copyInviteCode"
          >
            Copy invite code ♡
          </button>
        </div>

        <p v-if="errorMessage" class="error" role="alert">
          {{ errorMessage }}
        </p>

        <p class="hint">
          Share this code only with people you trust.
          Joining by invitation will be available once
          the Join Family feature is implemented.
        </p>

        <RouterLink to="/home" class="done-link">
          Back to home →
        </RouterLink>
      </template>
    </section>

    <p class="footer-note">
      Care together, closer always. ♡
    </p>
  </main>

</template>


