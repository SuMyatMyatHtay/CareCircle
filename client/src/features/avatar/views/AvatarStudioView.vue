<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AvatarPreview from '../components/AvatarPreview.vue'
import { categories, wardrobe, defaultAppearance } from '../data/avatarWardrobe.js'
import { getSavedAvatar, saveAvatar } from '../services/avatarApi.js'
import '../../../styles/avatarStudio.css'
const router = useRouter()
const appearance = ref(defaultAppearance())
const category = ref('tops')
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const snapshot = ref('')
const currentItems = computed(() => wardrobe[category.value] || [])
const modified = computed(() => JSON.stringify(appearance.value) !== snapshot.value)
const field = computed(() => ({ tops: 'top', bottoms: 'bottom', shoes: 'shoes', accessories: 'accessory' })[category.value])
function selected(id) { return category.value === 'bases' ? appearance.value.baseId === id : appearance.value.equipped[field.value] === id }
function choose(id) {
  if (category.value === 'bases') appearance.value.baseId = id
  else appearance.value.equipped[field.value] = id
  success.value = ''
}
function clearOutfit() { appearance.value.equipped = defaultAppearance().equipped; success.value = '' }
async function load() {
  loading.value = true; error.value = ''
  try {
    const saved = await getSavedAvatar()
    appearance.value = { baseId: saved?.baseId || 'base-01', equipped: { ...defaultAppearance().equipped, ...saved?.equipped } }
    snapshot.value = JSON.stringify(appearance.value)
  } catch (e) { error.value = e.response?.data?.message || e.message || 'Unable to load avatar.' }
  finally { loading.value = false }
}
async function save() {
  if (saving.value || !modified.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    const user = await saveAvatar(appearance.value)
    appearance.value = { baseId: user.avatarAppearance.baseId, equipped: { ...defaultAppearance().equipped, ...user.avatarAppearance.equipped } }
    snapshot.value = JSON.stringify(appearance.value)
    sessionStorage.setItem('user', JSON.stringify(user))
    window.dispatchEvent(new Event('carecircle:profile-updated'))
    success.value = 'Your avatar look is saved! ♡'
  } catch (e) { error.value = e.response?.data?.message || 'Unable to save your look.' }
  finally { saving.value = false }
}
onMounted(load)
</script>
<template>
  <div class="avatar-studio container-fluid pt-4 pb-5">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        <RouterLink to="/profile" class="text-success text-decoration-none small fw-bold"><i class="bi bi-arrow-left me-1"></i>Back to profile</RouterLink>
        <div class="avatar-eyebrow mt-3">♡ YOUR LITTLE WORLD ♡</div>
        <h1 class="fw-bold mt-2">Avatar Studio</h1>
        <p class="text-secondary mb-0">Express yourself, one outfit at a time! ♡</p>
      </div>
      <button type="button" class="btn btn-outline-secondary rounded-pill" :disabled="loading || saving" @click="clearOutfit"><i class="bi bi-arrow-counterclockwise me-1"></i>Clear outfit</button>
    </div>
    <div v-if="loading" class="text-center py-5"><div class="spinner-border text-success" role="status"></div><p class="mt-2">Opening wardrobe...</p></div>
    <div v-else class="row g-4 align-items-start">
      <div class="col-12 col-lg-5">
        <section class="avatar-card p-3 p-md-4">
          <div class="avatar-eyebrow mb-3"><i class="bi bi-stars me-1"></i>LIVE PREVIEW</div>
          <div class="avatar-preview-background rounded-4 p-3"><AvatarPreview :appearance="appearance" /></div>
          <div v-if="error" class="alert alert-danger mt-3" role="alert">{{ error }}</div>
          <div v-if="success" class="alert alert-success mt-3" role="status">{{ success }}</div>
          <button type="button" class="btn avatar-save-btn w-100 fw-bold rounded-4 py-3 mt-3" :disabled="saving || !modified" @click="save">
            <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
            {{ saving ? 'Saving...' : modified ? 'Save my look ♡' : 'Look saved ✓' }}
          </button>
          <button class="btn btn-link text-success text-decoration-none w-100 mt-2" @click="router.push('/profile')">Return to my profile</button>
        </section>
      </div>
      <div class="col-12 col-lg-7">
        <section class="avatar-card p-3 p-md-4">
          <h2 class="h4 fw-bold mb-1">My little wardrobe ♡</h2>
          <p class="text-secondary small mb-4">Choose a category and try on different styles.</p>
          <div class="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Wardrobe category">
            <button v-for="c in categories" :key="c.id" type="button" class="btn rounded-pill px-3" :class="category === c.id ? 'btn-success' : 'btn-outline-success'" :aria-pressed="category === c.id" @click="category = c.id"><i class="bi me-1" :class="c.icon"></i>{{ c.label }}</button>
          </div>
          <div class="d-flex justify-content-between mb-3"><strong>{{ categories.find(c => c.id === category)?.label }}</strong><span class="text-secondary small">{{ currentItems.length }} styles</span></div>
          <div class="row row-cols-2 row-cols-sm-3 g-3">
            <div class="col" v-if="category !== 'bases'"><button type="button" class="avatar-item w-100 h-100" :class="{ selected: selected('') }" @click="choose('')"><div class="avatar-item-image d-flex align-items-center justify-content-center"><i class="bi bi-slash-circle fs-2 text-secondary"></i></div><span class="small fw-bold d-block mt-2">None</span></button></div>
            <div class="col" v-for="item in currentItems" :key="item.id"><button type="button" class="avatar-item w-100 h-100 position-relative" :class="{ selected: selected(item.id) }" :aria-pressed="selected(item.id)" @click="choose(item.id)"><div class="avatar-item-image"><img :src="item.image" :alt="item.name" class="w-100 h-100" loading="lazy" @error="$event.target.style.visibility = 'hidden'" /></div><span class="small fw-bold d-block mt-2">{{ item.name }}</span><i v-if="selected(item.id)" class="bi bi-check-circle-fill avatar-check"></i></button></div>
          </div>
          <p class="small text-secondary mt-4 mb-0"><i class="bi bi-info-circle me-1"></i>Artwork uses aligned transparent PNGs. See README for exact filenames.</p>
        </section>
      </div>
    </div>
  </div>
</template>
