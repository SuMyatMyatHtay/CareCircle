<script setup>
import { ref,computed,onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AvatarPreview from '../components/AvatarPreview.vue'
import { categories,wardrobe,defaultAppearance } from '../data/avatarWardrobe.js'
import { getSavedAvatar,saveAvatar } from '../services/avatarApi.js'
import '../../../styles/avatarStudio.css'
const router=useRouter()
const appearance=ref(defaultAppearance())
const category=ref('dresses')
const loading=ref(true),saving=ref(false),error=ref(''),success=ref(''),snapshot=ref('')
const currentItems=computed(()=>wardrobe[category.value]||[])
const modified=computed(()=>JSON.stringify(appearance.value)!==snapshot.value)
function fieldFor(c) {return ({dresses:'dress',tops:'top',skirts:'bottom',shorts:'bottom',shoes:'shoes',accessories:'accessory'})[c]}
function selected(id) {return category.value==='bases' ? appearance.value.baseId===id : appearance.value.equipped[fieldFor(category.value)]===id}

function choose(id) {
  // Check if the selected item is locked
  const item = currentItems.value.find(item => item.id === id)

  if (item?.comingSoon) return

  success.value = ''

  if (category.value === 'bases') {
    appearance.value.baseId = id
  } else {
    const e = appearance.value.equipped

    if (category.value === 'dresses' && id) {
      e.top = ''
      e.bottom = ''
    }

    if (['tops', 'skirts', 'shorts'].includes(category.value) && id) {
      e.dress = ''
    }

    e[fieldFor(category.value)] = id
  }
}

function clearOutfit() {appearance.value.equipped={...defaultAppearance().equipped};success.value=''}
async function load() {
 loading.value=true;error.value=''
 try {const saved=await getSavedAvatar();appearance.value={baseId:wardrobe.bases.some(x=>x.id===saved?.baseId)?saved.baseId:'cat',equipped:{...defaultAppearance().equipped,...saved?.equipped}};snapshot.value=JSON.stringify(appearance.value)}
 catch(e) {error.value=e.response?.data?.message||'Unable to load saved avatar.'}
 finally {loading.value=false}
}
async function save() {
 if(saving.value||!modified.value)return
 saving.value=true;error.value='';success.value=''
 try {
  const user=await saveAvatar(appearance.value)
  appearance.value={baseId:user.avatarAppearance.baseId,equipped:{...defaultAppearance().equipped,...user.avatarAppearance.equipped}}
  snapshot.value=JSON.stringify(appearance.value)
  sessionStorage.setItem('user',JSON.stringify(user))
  window.dispatchEvent(new Event('carecircle:profile-updated'))
  success.value='Your cute new look is saved! ♡'
 } catch(e) {error.value=e.response?.data?.message||'Unable to save your outfit.'}
 finally {saving.value=false}
}
onMounted(load)
</script>
<template>
  <div class="avatar-studio container-fluid pt-4 pb-5">
    <div class="d-flex justify-content-between flex-wrap align-items-start gap-3 mb-4">
      <div><RouterLink to="/profile" class="text-success text-decoration-none fw-bold small"><i class="bi bi-arrow-left me-1"></i>Back to profile</RouterLink>
        <div class="avatar-eyebrow mt-3">♡ A LITTLE WARDROBE MAGIC ♡</div>
        <h1 class="fw-bold mt-2 mb-1">Cute Dress-Up Studio</h1>
        <p class="text-secondary mb-0">Pick your character, mix cute outfits, and save your look. ♡</p>
      </div>
      <button type="button" class="btn btn-outline-secondary rounded-pill" :disabled="loading||saving" @click="clearOutfit"><i class="bi bi-arrow-counterclockwise me-2"></i>Clear outfit</button>
    </div>
    <div v-if="loading" class="py-5 text-center" role="status"><div class="spinner-border text-success"></div><p class="mt-3">Opening the wardrobe...</p></div>
    <div v-else class="row g-4 align-items-start">
      <div class="col-12 col-lg-5 col-xxl-4"><section class="avatar-card p-3 p-md-4">
        <div class="avatar-eyebrow mb-3"><i class="bi bi-stars me-1"></i>LIVE PREVIEW</div>
        <div class="avatar-preview-background rounded-4 p-2 p-md-3"><AvatarPreview :appearance="appearance" /></div>
        <p class="small text-secondary text-center mt-3 mb-0">{{ wardrobe.bases.find(x=>x.id===appearance.baseId)?.name }} · Outfit preview</p>
        <p v-if="error" class="alert alert-danger rounded-4 mt-3 mb-0" role="alert">{{error}}</p>
        <p v-if="success" class="alert alert-success rounded-4 mt-3 mb-0" role="status">{{success}}</p>
        <button type="button" class="btn avatar-save-btn w-100 fw-bold rounded-4 py-3 mt-3" :disabled="saving||!modified" @click="save"><span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>{{saving?'Saving...':modified?'Save my look ♡':'Look saved ✓'}}</button>
        <button type="button" class="btn btn-link text-success text-decoration-none w-100 mt-2" @click="router.push('/profile')">Return to profile</button>
      </section></div>
      <div class="col-12 col-lg-7 col-xxl-8"><section class="avatar-card p-3 p-md-4">
        <h2 class="h4 fw-bold mb-1">My little wardrobe ♡</h2><p class="small text-secondary mb-3">Click a piece to try it on. Dresses replace tops and bottoms.</p>
        <div class="d-flex gap-2 flex-wrap mb-4" role="group" aria-label="Wardrobe category">
          <button v-for="c in categories" :key="c.id" type="button" class="btn rounded-pill px-3" :class="category===c.id?'btn-success':'btn-outline-success'" :aria-pressed="category===c.id" @click="category=c.id"><i class="bi me-1" :class="c.icon"></i>{{c.label}}</button>
        </div>
        <div class="d-flex justify-content-between mb-3"><strong>{{categories.find(c=>c.id===category)?.label}}</strong><span class="small text-secondary">{{currentItems.length}} styles</span></div>
        <div class="row row-cols-2 row-cols-sm-3 row-cols-xl-4 g-3">
          <div v-if="category!=='bases'" class="col"><button type="button" class="avatar-item w-100 h-100" :class="{selected:selected('')}" @click="choose('')"><div class="avatar-item-image d-flex align-items-center justify-content-center"><i class="bi bi-slash-circle fs-2 text-secondary"></i></div><span class="small fw-bold d-block mt-2">None</span></button></div>
          
        <div
          v-for="item in currentItems"
          :key="item.id"
          class="col"
        >
          <button
            type="button"
            class="avatar-item w-100 h-100 position-relative"
            :class="{
              selected: selected(item.id) && !item.comingSoon,
              'avatar-item-locked': item.comingSoon
            }"
            :disabled="item.comingSoon === true"
            :aria-pressed="selected(item.id)"
            @click="choose(item.id)"
          >
            <!-- Character / clothing image -->
            <div class="avatar-item-image">
              <img
                :src="item.image"
                :alt="item.name"
                class="w-100 h-100"
                loading="lazy"
              />
            </div>

            <!-- Character name -->
            <span class="small fw-bold d-block mt-2">
              {{ item.name }}
            </span>

            <!-- Coming Soon label -->
            <span
              v-if="item.comingSoon"
              class="avatar-coming-soon badge rounded-pill mt-2"
            >
              <i class="bi bi-lock-fill me-1"></i>
              Coming Soon
            </span>

            <!-- Selected checkmark -->
            <i
              v-else-if="selected(item.id)"
              class="bi bi-check-circle-fill avatar-check"
            ></i>
          </button>
        </div>

        </div>
        <p class="small text-secondary mt-4 mb-0"><i class="bi bi-info-circle me-1"></i>The supplied illustrations are sprite sheets. Clothes are overlaid with approximate positioning; you can fine-tune each layer in AvatarPreview.vue.</p>
      </section></div>
    </div>
  </div>
</template>
