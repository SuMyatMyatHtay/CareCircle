
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  joinFamily,
  getFamilyErrorMessage
} from '../../family/services/familyApi.js'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'

import familyPoster from '../../../assets/create-family-hero.png'

const router = useRouter()
const { loadFamilies, selectFamily } = useActiveFamily()

const inviteCode = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const joinedFamily = ref(null)

const normalizedCode = computed(() =>
  inviteCode.value.trim().toUpperCase()
)

const isValid = computed(() =>
  /^[A-F0-9]{10}$/.test(normalizedCode.value) &&
  !isLoading.value
)

async function handleJoinFamily() {
  if (isLoading.value) return

  errorMessage.value = ''

  if (!isValid.value) {
    errorMessage.value =
      'Please enter a valid 10-character invitation code.'
    return
  }

  isLoading.value = true

  try {
    const response = await joinFamily(normalizedCode.value)

    if (response.success !== true || !response.family?.id) {
      throw new Error('Unexpected server response.')
    }

    joinedFamily.value = response.family

    // Remember newly joined family and refresh shared sidebar data
    selectFamily(response.family.id)
    await loadFamilies()

  } catch (error) {
    errorMessage.value = getFamilyErrorMessage(error)

  } finally {
    isLoading.value = false
  }
}

function goToFamily() {
  router.push('/home')
}
</script>


<template>
  <main
    class="join-family-page min-vh-100 d-flex
           align-items-center justify-content-center
           px-3 py-5"
  >
    <div class="container" style="max-width: 680px">

      <section class="join-family-card bg-white shadow-lg rounded-5 p-4 p-md-5">

        <!-- Back to home -->
        <div class="d-flex justify-content-start mb-3">
          <RouterLink
            to="/home"
            class="text-decoration-none fw-bold join-back-link"
          >
            <i class="bi bi-arrow-left me-2"></i>
            Back to home
          </RouterLink>
        </div>

        <!-- Illustration -->
        <div class="position-relative mb-3">
          <img
            :src="familyPoster"
            alt="A happy family together"
            class="join-family-image w-100 rounded-4"
          />

          <span
            class="floating-heart position-absolute top-0 start-0 ms-3 mt-3"
            aria-hidden="true"
          >
            ♥
          </span>

          <span
            class="floating-heart position-absolute bottom-0 end-0 me-4 mb-3"
            aria-hidden="true"
          >
            ♥
          </span>
        </div>

        <!-- Main content -->
        <div class="text-center">

          <span class="join-eyebrow d-inline-block rounded-pill px-3 py-2 mb-3">
            ♡ BETTER TOGETHER ♡
          </span>

          <!-- Join form -->
          <template v-if="!joinedFamily">

            <h1 class="fw-bold mb-3">
              Join your family circle!
            </h1>

            <p class="join-subtitle mx-auto mb-4">
              Your loved ones are waiting for you!
              Enter your invitation code to join the circle. ♡
            </p>

            <form
              class="text-start"
              @submit.prevent="handleJoinFamily"
            >
              <label
                for="inviteCode"
                class="form-label fw-bold mb-2"
              >
                What's your family invitation code?
              </label>

              <input
                id="inviteCode"
                v-model="inviteCode"
                type="text"
                class="form-control form-control-lg rounded-4"
                placeholder="e.g. A1B2C3D4E5"
                maxlength="10"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                :disabled="isLoading"
                @input="inviteCode = normalizedCode"
              />

              <div class="form-text mb-4">
                Enter the 10-character code shared by your family admin.
              </div>

              <div
                v-if="errorMessage"
                class="alert alert-danger rounded-4 py-2"
                role="alert"
              >
                <i class="bi bi-exclamation-circle me-2"></i>
                {{ errorMessage }}
              </div>

              <button
                type="submit"
                class="btn join-submit w-100 rounded-4
                       fw-bold py-3"
                :disabled="!isValid"
              >
                <span
                  v-if="isLoading"
                  class="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                ></span>

                {{ isLoading
                  ? 'Joining your circle...'
                  : 'Join my family ♡'
                }}
              </button>
            </form>
          </template>

          <!-- Success state -->
          <template v-else>
            <h1 class="fw-bold mb-3">
              Welcome to the family! ♡
            </h1>

            <p class="join-subtitle mx-auto mb-4">
              You've successfully joined
              <strong>{{ joinedFamily.name }}</strong>!
              Your caring journey starts here.
            </p>

            <div class="join-success-card rounded-4 p-4 mb-4">
              <div class="small fw-bold mb-2">
                YOUR NEW FAMILY CIRCLE
              </div>

              <h2 class="fw-bold mb-2">
                {{ joinedFamily.name }}
              </h2>

              <p class="mb-0">
                You're now a member of this family. ♡
              </p>
            </div>

            <button
              type="button"
              class="btn join-submit w-100 rounded-4 fw-bold py-3"
              @click="goToFamily"
            >
              Go to my family
              <i class="bi bi-arrow-right ms-2"></i>
            </button>
          </template>

        </div>
      </section>

      <!-- Footer -->
      <p class="text-center small join-footer mt-2 mb-0">
        Care together, closer always. ♡
      </p>

    </div>
  </main>
</template>

<style src="../../../styles/joinFamilyView.css" scoped></style>
