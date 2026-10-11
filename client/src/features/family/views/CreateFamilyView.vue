
<script setup>
import { ref, computed } from 'vue'
import {
  createFamily,
  getFamilyErrorMessage
} from '../services/familyApi.js'

import familyPoster from '../../../assets/create-family-hero.png'

const familyName = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const createdFamily = ref(null)
const copied = ref(false)

const isValid = computed(() => {
  const name = familyName.value.trim()
  return name.length >= 2 && name.length <= 80 && !isLoading.value
})

async function handleCreateFamily() {
  errorMessage.value = ''
  copied.value = false

  if (!isValid.value) {
    errorMessage.value = 'Please enter a family name between 2 and 80 characters.'
    return
  }

  isLoading.value = true

  try {
    const response = await createFamily(familyName.value.trim())

    if (
      response.success !== true ||
      !response.family?.id ||
      !response.family?.inviteCode
    ) {
      throw new Error('Unexpected server response.')
    }

    createdFamily.value = response.family
  } catch (error) {
    errorMessage.value = getFamilyErrorMessage(error)
  } finally {
    isLoading.value = false
  }
}

async function copyInviteCode() {
  if (!createdFamily.value?.inviteCode) return

  errorMessage.value = ''

  try {
    await navigator.clipboard.writeText(createdFamily.value.inviteCode)
    copied.value = true
  } catch {
    errorMessage.value = 'Unable to copy. Please select the code manually.'
  }
}
</script>

<template>
  <main class="create-family-page">

    <div class="family-content">

      <section class="family-card">

        <div class="back-row">
          <RouterLink to="/home" class="back-link">
            ← Back to home
          </RouterLink>
        </div>

        <!-- Family illustration -->
        <div class="family-art">
          <img
            :src="familyPoster"
            alt="A happy multigenerational family"
            class="family-picture"
          />
          <span class="floating-heart heart-left" aria-hidden="true">♥</span>
          <span class="floating-heart heart-right" aria-hidden="true">♥</span>
        </div>

        <div class="eyebrow">♡ CARE STARTS HERE ♡</div>

        <!-- Creation form -->
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
              autocomplete="off"
              :disabled="isLoading"
            />

            <p class="hint">
              {{ familyName.trim().length }}/80 characters
            </p>

            <p v-if="errorMessage" class="error" role="alert">
              {{ errorMessage }}
            </p>

            <button type="submit" :disabled="!isValid">
              {{ isLoading ? 'Creating your circle...' : 'Create my family ♡' }}
            </button>
          </form>
        </template>

        <!-- Success screen -->
        <template v-else>
          <h1>Your circle is ready! ♡</h1>

          <p class="subtitle">
            <strong>{{ createdFamily.name }}</strong>
            has been created successfully.
            You're now the family admin!
          </p>

          <div class="invite-code-card">
            <p>YOUR FAMILY INVITE CODE</p>
            <h2>{{ createdFamily.inviteCode }}</h2>

            <button type="button" @click="copyInviteCode">
              {{ copied ? 'Copied! ✓' : 'Copy invite code ♡' }}
            </button>
          </div>

          <p v-if="errorMessage" class="error" role="alert">
            {{ errorMessage }}
          </p>

          <p class="hint invite-hint">
            Share this code with your loved ones.
          </p>

          <RouterLink to="/home" class="done-link">
            Back to home →
          </RouterLink>
        </template>

      </section>

      <p class="footer-note">
        Care together, closer always. ♡
      </p>

    </div>
  </main>
</template>

<style src="../../../styles/createFamilyView.css" scoped></style>
