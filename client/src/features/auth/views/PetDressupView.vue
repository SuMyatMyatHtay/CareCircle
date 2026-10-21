<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PetAvatar from '../components/PetAvatar.vue'
import { getMyProfile, updateMyPet } from '../services/authApi.js'
import '../../../styles/petDressupView.css'

const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const tab = ref('tops')
const pet = ref({ species: 'fox', name: 'My buddy', equipped: { outfit: '', bottom: '' } })
const lastSaved = ref('')
const pictures = import.meta.glob('../../../assets/pets/**/*.png', { eager: true, query: '?url', import: 'default' })
const imageFor = (type, id) => pictures[`../../../assets/pets/${type}/${id}.png`] || ''
const sections = [
  { id: 'tops', label: 'Tops', icon: 'bi-bag-heart', field: 'outfit', prefix: 'tops', count: 10 },
  { id: 'skirts', label: 'Skirts', icon: 'bi-stars', field: 'bottom', prefix: 'skirts', count: 16 },
  { id: 'shorts', label: 'Shorts', icon: 'bi-suit-heart', field: 'bottom', prefix: 'shorts', count: 20 }
]
const active = computed(() => sections.find(s => s.id === tab.value) || sections[0])
const items = computed(() => Array.from({ length: active.value.count }, (_, i) => ({
  id: `${active.value.prefix}-${String(i + 1).padStart(2, '0')}`,
  url: imageFor(active.value.prefix, `${active.value.prefix}-${String(i + 1).padStart(2, '0')}`)
})))
const selected = computed(() => pet.value.equipped?.[active.value.field] || '')
const changed = computed(() => JSON.stringify(pet.value) !== lastSaved.value)
function selectItem(id) {
  pet.value.equipped[active.value.field] = id
  success.value = ''
}
function resetClothes() {
  pet.value.equipped = { outfit: '', bottom: '' }
  success.value = ''
}
async function load() {
  try {
    const user = await getMyProfile()
    const saved = user.petAppearance || {}
    pet.value = {
      species: ['cat', 'fox'].includes(saved.species) ? saved.species : 'fox',
      name: saved.name || 'My buddy',
      equipped: {
        outfit: saved.equipped?.outfit || '',
        bottom: saved.equipped?.bottom || ''
      }
    }
    lastSaved.value = JSON.stringify(pet.value)
  } catch (e) {
    error.value = e.response?.data?.message || 'Could not load your companion.'
  } finally { loading.value = false }
}
async function save() {
  if (saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    const updated = await updateMyPet(pet.value)
    pet.value = {
      species: updated.petAppearance.species,
      name: updated.petAppearance.name,
      equipped: {
        outfit: updated.petAppearance.equipped?.outfit || '',
        bottom: updated.petAppearance.equipped?.bottom || ''
      }
    }
    lastSaved.value = JSON.stringify(pet.value)
    sessionStorage.setItem('user', JSON.stringify(updated))
    window.dispatchEvent(new Event('carecircle:profile-updated'))
    success.value = 'Your buddy’s look is saved! ♡'
  } catch (e) {
    error.value = e.response?.data?.message || 'Could not save your outfit. Please try again.'
  } finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <div class="dressup-page container-fluid pb-4">
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
      <div>
        <RouterLink to="/profile" class="text-decoration-none text-success fw-bold small"><i class="bi bi-arrow-left me-1"></i> Back to my profile</RouterLink>
        <div class="dressup-kicker mt-2">♡ YOUR COMPANION'S CLOSET ♡</div>
        <h1 class="fw-black mt-1 mb-1">Little Buddy Boutique</h1>
        <p class="text-secondary mb-0">Mix, match and make your buddy adorable!</p>
      </div>
      <button class="btn btn-outline-secondary rounded-pill" type="button" @click="resetClothes" :disabled="loading"><i class="bi bi-arrow-counterclockwise me-1"></i> Clear outfit</button>
    </div>

    <div v-if="loading" class="py-5 text-center" role="status"><div class="spinner-border text-success"></div><p>Opening the wardrobe...</p></div>
    <div v-else class="row g-4">
      <div class="col-12 col-lg-5 col-xxl-4">
        <div class="dressup-card p-3 p-md-4 sticky-preview">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="dressup-pill"><i class="bi bi-heart-fill me-1"></i> LIVE PREVIEW</span>
            <span class="small text-secondary">Changes preview instantly</span>
          </div>
          <PetAvatar :appearance="pet" />
          <div class="d-flex gap-2 justify-content-center my-3">
            <button v-for="option in ['fox', 'cat']" :key="option" type="button" class="btn rounded-pill px-3" :class="pet.species === option ? 'btn-success' : 'btn-outline-success'" @click="pet.species = option; success = ''">{{ option === 'fox' ? '🦊 Fox' : '🐱 Cat' }}</button>
          </div>
          <label for="petName" class="form-label fw-bold small">Your pet's name</label>
          <input id="petName" v-model.trim="pet.name" class="form-control rounded-3" maxlength="30" placeholder="Give your buddy a name" />
          <p v-if="success" class="alert alert-success py-2 mt-3 mb-0" role="status">{{ success }}</p>
          <p v-if="error" class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ error }}</p>
          <button class="btn btn-success w-100 fw-bold rounded-4 mt-3 py-3" :disabled="saving || !changed" @click="save"><span v-if="saving" class="spinner-border spinner-border-sm me-2"></span><i v-else class="bi bi-heart-fill me-2"></i>{{ saving ? 'Saving outfit...' : changed ? 'Save my buddy’s look ♡' : 'Outfit saved ✓' }}</button>
        </div>
      </div>
      <div class="col-12 col-lg-7 col-xxl-8">
        <div class="dressup-card p-3 p-md-4">
          <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
            <h2 class="h4 fw-bold mb-0">Pick something cute ♡</h2>
            <span class="small text-secondary">{{ active.count }} styles to try</span>
          </div>
          <div class="d-flex gap-2 flex-wrap mb-4" role="tablist" aria-label="Outfit category">
            <button v-for="section in sections" :key="section.id" class="btn rounded-pill dressup-tab" :class="tab === section.id ? 'btn-success' : 'btn-outline-success'" role="tab" :aria-selected="tab === section.id" @click="tab = section.id"><i class="bi me-1" :class="section.icon"></i>{{ section.label }}</button>
          </div>
          <div class="row row-cols-2 row-cols-sm-3 row-cols-xl-4 g-3">
            <div class="col">
              <button type="button" class="dressup-item h-100 w-100" :class="{ 'dressup-item--active': !selected }" @click="selectItem('')">
                <div class="dressup-no-item"><i class="bi bi-slash-circle"></i></div>
                <span class="small fw-bold">None</span>
              </button>
            </div>
            <div v-for="(item,index) in items" :key="item.id" class="col">
              <button type="button" class="dressup-item h-100 w-100" :class="{ 'dressup-item--active': selected === item.id }" :aria-pressed="selected === item.id" @click="selectItem(item.id)">
                <img :src="item.url" :alt="`${active.label} design ${index+1}`" loading="lazy" />
                <span class="small fw-bold">Style {{ index + 1 }}</span>
                <i v-if="selected === item.id" class="bi bi-check-circle-fill dressup-check"></i>
              </button>
            </div>
          </div>
          <p class="small text-secondary mt-4 mb-0"><i class="bi bi-info-circle me-1"></i> Each piece is cut from your original art sheets. Fit is approximate because the sheets do not include per-piece alignment coordinates.</p>
        </div>
      </div>
    </div>
  </div>
</template>
