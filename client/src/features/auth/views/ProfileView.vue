
<script setup>
import PetAvatar from '../components/PetAvatar.vue'
import { ref, reactive, onMounted, computed } from 'vue'
import { getMyProfile, updateMyProfile } from '../services/authApi.js'
import '../../../styles/profileView.css'

const user = ref(null)
const editing = ref(false)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

const form = reactive({
    name: '',
    phone: '',
    preferredLang: 'en',
    telegramUsername: '', 
    isCaretaker: false
})

const languages = {
    en: 'English',
    zh: 'Chinese',
    ms: 'Malay',
    ta: 'Tamil'
}

const initials = computed(() =>
    user.value?.name?.trim().charAt(0).toUpperCase() || '?'
)

const pet = computed(() => user.value?.petAppearance)

const petName = computed(() => pet.value?.name || 'My little buddy')

function fillForm(data) {
    form.name = data.name || ''
    form.phone = data.phone || ''
    form.preferredLang = data.preferredLang || 'en'
    form.telegramUsername = data.telegramUsername || ''
    form.isCaretaker = data.isCaretaker ?? false
}

async function loadProfile() {
    loading.value = true
    error.value = ''

    try {
        user.value = await getMyProfile()
        fillForm(user.value)
    } catch (err) {
        error.value =
        err.response?.data?.message ||
        'Unable to load your profile.'
    } finally {
        loading.value = false
    }
}

function cancelEdit() {
    fillForm(user.value)
    editing.value = false
    error.value = ''
}

async function saveProfile() {
    if (saving.value) return

    saving.value = true
    error.value = ''
    success.value = ''

    try {
        const updated = await updateMyProfile({ ...form })
        user.value = updated
        sessionStorage.setItem('user', JSON.stringify(updated))
        window.dispatchEvent(new Event('carecircle:profile-updated'))

        editing.value = false
        success.value = 'Your profile has been saved! ♡'
    } catch (err) {
        error.value =
        err.response?.data?.message ||
        'Unable to save your changes.'
    } finally {
        saving.value = false
    }
}

onMounted(loadProfile)
</script>

<template>
    <div class="profile-page container-fluid pt-4 pt-md-5">

        <div class="mb-4">
        <div class="profile-eyebrow mb-2">
            ♡ YOUR LITTLE CORNER ♡
        </div>
        <h1 class="fw-bold mb-2">My Profile</h1>
        <p class="text-secondary mb-0">
            A little space for you and your care companion.
        </p>
        </div>

        <div v-if="loading" class="text-center py-5" role="status">
        <div class="spinner-border text-success"></div>
        <p class="text-secondary mt-3">Loading your little corner...</p>
        </div>

        <template v-else-if="user">
        <div
            v-if="success"
            class="alert alert-success rounded-4"
            role="status"
        >
            {{ success }}
        </div>

        <div class="row g-4 align-items-start">

            <!-- LEFT: ACCOUNT PROFILE -->
            <div class="col-12 col-xl-7">

            <section class="profile-card bg-white rounded-4 p-4 mb-4">

                <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
                <div class="profile-initial rounded-circle flex-shrink-0">
                    {{ initials }}
                </div>

                <div class="flex-grow-1">
                    <h2 class="h4 fw-bold mb-1">{{ user.name }}</h2>
                    <p class="text-secondary small mb-1">
                    {{ user.email }}
                    </p>
                    <span class="profile-pill badge rounded-pill px-3 py-2">
                    <i class="bi bi-heart-fill me-1"></i>
                    CareCircle Member
                    </span>
                </div>
                </div>

                <div class="d-flex justify-content-between align-items-center mb-3">
                <h3 class="h5 fw-bold mb-0">
                    <i class="bi bi-person-heart me-2 profile-green"></i>
                    Personal details
                </h3>

                <button
                    v-if="!editing"
                    type="button"
                    class="btn btn-sm profile-outline rounded-pill px-3"
                    @click="editing = true; success = ''"
                >
                    <i class="bi bi-pencil-square me-1"></i>
                    Edit
                </button>
                </div>

                <form @submit.prevent="saveProfile">
                <div class="row g-3">

                    <div class="col-12">
                    <label for="profileName" class="form-label fw-semibold small">
                        Full name
                    </label>
                    <input
                        id="profileName"
                        v-model="form.name"
                        class="form-control rounded-3"
                        maxlength="80"
                        minlength="2"
                        required
                        :disabled="!editing"
                    />
                    </div>

                    <div class="col-12">
                    <label for="profileEmail" class="form-label fw-semibold small">
                        Email address
                    </label>
                    <input
                        id="profileEmail"
                        :value="user.email"
                        type="email"
                        class="form-control rounded-3"
                        disabled
                    />
                    <div class="form-text">
                        Your email cannot be changed here.
                    </div>
                    </div>

                    <div class="col-12 col-md-6">
                    <label for="profilePhone" class="form-label fw-semibold small">
                        Phone number
                    </label>
                    <input
                        id="profilePhone"
                        v-model="form.phone"
                        type="tel"
                        class="form-control rounded-3"
                        placeholder="Not added yet"
                        maxlength="30"
                        :disabled="!editing"
                    />
                    </div>

                    <div class="col-12 col-md-6">
                    <label for="profileLang" class="form-label fw-semibold small">
                        Preferred language
                    </label>
                    <select
                        id="profileLang"
                        v-model="form.preferredLang"
                        class="form-select rounded-3"
                        :disabled="!editing"
                    >
                        <option
                        v-for="(label, code) in languages"
                        :key="code"
                        :value="code"
                        >
                        {{ label }}
                        </option>
                    </select>
                    </div>

                    <div class="col-12">
                    <label for="profileTelegram" class="form-label fw-semibold small">
                        Telegram username
                    </label>
                    <div class="input-group">
                        <span class="input-group-text">@</span>
                        <input
                        id="profileTelegram"
                        v-model="form.telegramUsername"
                        class="form-control"
                        placeholder="username"
                        maxlength="32"
                        :disabled="!editing"
                        />
                    </div>
                    </div>

                    <div class="col-12">
                        <div class="caretaker-option p-3 rounded-4">
                            <div class="form-check d-flex align-items-start gap-2 mb-0">
                            <input
                                id="isCaretaker"
                                v-model="form.isCaretaker"
                                class="form-check-input mt-1"
                                type="checkbox"
                                :disabled="!editing"
                            />

                            <label class="form-check-label" for="isCaretaker">
                                <span class="fw-bold d-block">
                                <i class="bi bi-heart-pulse me-1"></i>
                                I'm also a caretaker
                                </span>
                                <span class="d-block small text-secondary mt-1">
                                I help care for a family member or loved one.
                                </span>
                            </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    v-if="error"
                    class="alert alert-danger rounded-3 mt-3 mb-0"
                    role="alert"
                >
                    {{ error }}
                </div>

                <div v-if="editing" class="d-flex gap-2 justify-content-end mt-4">
                    <button
                    type="button"
                    class="btn btn-light rounded-pill px-4"
                    :disabled="saving"
                    @click="cancelEdit"
                    >
                    Cancel
                    </button>

                    <button
                        type="submit"
                        class="btn btn-success rounded-pill px-4 fw-bold"
                        :disabled="saving"
                    >
                        {{ saving ? 'Saving...' : 'Save changes ♡' }}
                    </button>
                </div>
                </form>

            </section>

            <section class="profile-card bg-white rounded-4 p-4">
                <h3 class="h5 fw-bold mb-3">
                <i class="bi bi-shield-check me-2 profile-green"></i>
                Account information
                </h3>

                <div class="d-flex justify-content-between flex-wrap gap-2">
                <span class="text-secondary small">Member since</span>
                <span class="fw-semibold small">
                    {{ user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString(
                        'en-SG',
                        { day: 'numeric', month: 'long', year: 'numeric' }
                    )
                    : '—'
                    }}
                </span>
                </div>

                <hr class="my-3" />

                <div class="d-flex justify-content-between flex-wrap gap-2">
                <span class="text-secondary small">Account type</span>
                <span class="fw-semibold small">CareCircle member</span>
                </div>
            </section>

            </div>

            <!-- RIGHT: PET PROFILE -->
            <div class="col-12 col-xl-5">

            <section class="profile-card bg-white rounded-4 p-4">

                <div class="text-center mb-3">
                <span class="profile-eyebrow">♡ MY LITTLE COMPANION ♡</span>
                <h2 class="h4 fw-bold mt-3 mb-2">
                    Meet your care buddy!
                </h2>
                <p class="text-secondary small mb-0">
                    A little friend to accompany your caring journey.
                </p>
                </div>

                <div class="pet-display rounded-4 p-4 text-center">

                <div class="pet-stage mx-auto mb-3">
                  <PetAvatar :appearance="pet || { species: 'fox', equipped: {} }" />
                </div>

                <h3 class="h5 fw-bold mb-1">
                    {{ petName }}
                </h3>

                <p class="text-secondary small mb-0">
                    {{ pet?.species
                    ? `${pet.species.replace('-', ' ')} companion`
                    : 'Choose your companion soon!'
                    }}
                </p>

                </div>

                <div class="d-grid gap-2 mt-3">
                <RouterLink
                    to="/dress-up"
                    class="btn profile-primary rounded-pill py-2 fw-bold"
                >
                    <i class="bi bi-stars me-2"></i>
                    Change clothes ♡
                </RouterLink>
                </div>

                <p class="small text-secondary text-center mt-3 mb-0">
                Dress your buddy in cute outfits, hats and accessories.
                Your saved look will appear right here! ♡
                </p>

            </section>

            </div>

        </div>
        </template>

        <div v-else class="alert alert-danger rounded-4" role="alert">
        {{ error || 'Unable to load profile.' }}
        <button
            type="button"
            class="btn btn-sm btn-outline-danger ms-2"
            @click="loadProfile"
        >
            Try again
        </button>
        </div>

    </div>
</template>
