
<script setup>
import { ref, computed } from 'vue'
import {
  createFamily,
  getFamilyErrorMessage
} from '../services/familyApi.js'

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

  
<style scoped>
  .create-family-page {
    min-height: 100vh;
    background: radial-gradient(circle at 15% 20%, #E8F5E9, transparent 35%),
                radial-gradient(circle at 85% 75%, #FFE8E3, transparent 35%),
                #FBF8F7;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 75px 20px 30px;
    font-family: 'Nunito', system-ui, sans-serif;
  }

  .back-link {
    position: absolute;
    top: 30px;
    left: 35px;
    color: #579C72;
    text-decoration: none;
    font-weight: 800;
  }

  .family-card {
    width: 100%;
    max-width: 520px;
    padding: 40px;
    background: #FFFFFF;
    border: 2px solid #E5F1E8;
    border-radius: 30px;
    text-align: center;
    box-shadow: 0 18px 50px #6E997A20;
  }

  .family-art { font-size: 70px; }
  .success-art { font-size: 55px; }

  .eyebrow {
    color: #579C72;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 2px;
    margin-top: 14px;
  }

  h1 {
    font-size: 32px;
    font-weight: 900;
    margin: 18px 0;
    color: #2F2F2F;
  }

  .subtitle {
    color: #7D847F;
    line-height: 1.7;
    margin-bottom: 25px;
  }

  form { text-align: left; }

  label {
    font-weight: 800;
    display: block;
    margin-bottom: 10px;
  }

  input {
    width: 100%;
    padding: 14px 18px;
    border: 2px solid #D9EADD;
    border-radius: 15px;
    background: white;
    outline: none;
  }

  input:focus {
    border-color: #6DBF7C;
    box-shadow: 0 0 0 4px #6DBF7C20;
  }

  .hint {
    font-size: 12px;
    color: #98A29A;
    margin: 9px 0 20px;
  }

  button {
    width: 100%;
    padding: 15px;
    background: #6DBF7C;
    color: #184529;
    border: none;
    border-radius: 15px;
    font-weight: 900;
    cursor: pointer;
  }

  button:hover:not(:disabled) { background: #5AAB6B; }
  button:disabled { opacity: .55; cursor: not-allowed; }

  .error {
    color: #C94C4C;
    font-size: 13px;
  }

  .invite-code-card {
    background: #E8F5E9;
    padding: 20px;
    border-radius: 20px;
    margin: 20px 0;
  }

  .invite-code-card p {
    font-size: 12px;
    font-weight: 900;
    color: #579C72;
  }

  .invite-code-card h2 {
    font-weight: 900;
    letter-spacing: 3px;
    overflow-wrap: anywhere;
  }

  .done-link {
    color: #579C72;
    text-decoration: none;
    font-weight: 800;
  }

  .footer-note {
    margin-top: 25px;
    color: #97A79B;
    font-size: 13px;
  }

  @media (max-width: 576px) {
    .family-card { padding: 26px 20px; }
    h1 { font-size: 26px; }
    .back-link { top: 20px; left: 20px; }
  }
</style>
