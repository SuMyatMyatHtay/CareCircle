<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { getMyProfile, updateMyProfile } from '../services/authApi.js'
import ProfilePicturePicker from '../../../components/common/ProfilePicturePicker.vue'
import AvatarPreview from '../../avatar/components/AvatarPreview.vue'
import { defaultAppearance } from '../../avatar/data/avatarWardrobe.js'
import '../../../styles/profileView.css'
const user=ref(null), editing=ref(false), loading=ref(true), saving=ref(false), error=ref(''), success=ref('')
const form=reactive({profilePicture:'',name:'',phone:'',preferredLang:'en',telegramUsername:'',isCaretaker:false})
const languages={en:'English',zh:'Chinese',ms:'Malay',ta:'Tamil'}
const avatarAppearance=computed(()=>({
  baseId:user.value?.avatarAppearance?.baseId||defaultAppearance().baseId,
  equipped:{...defaultAppearance().equipped,...user.value?.avatarAppearance?.equipped}
}))
function fillForm(data) {
  form.profilePicture=data.profilePicture||''
  form.name=data.name||'';form.phone=data.phone||'';form.preferredLang=data.preferredLang||'en'
  form.telegramUsername=data.telegramUsername||'';form.isCaretaker=data.isCaretaker??false
}
async function loadProfile() {
  loading.value=true;error.value=''
  try {user.value=await getMyProfile();fillForm(user.value)}
  catch(e){error.value=e.response?.data?.message||'Unable to load profile.'}
  finally{loading.value=false}
}
function cancelEdit(){fillForm(user.value);editing.value=false;error.value=''}
async function saveProfile(){
  if(saving.value)return
  saving.value=true;error.value='';success.value=''
  try{
    const updated=await updateMyProfile({...form});user.value=updated
    sessionStorage.setItem('user',JSON.stringify(updated))
    window.dispatchEvent(new Event('carecircle:profile-updated'))
    editing.value=false;success.value='Your profile has been saved! ♡'
  }catch(e){error.value=e.response?.data?.message||'Unable to save changes.'}
  finally{saving.value=false}
}
async function savePicture(profilePicture) {
  if (saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    const current = await getMyProfile()
    const updated = await updateMyProfile({ ...current, profilePicture })
    user.value = updated
    form.profilePicture = updated.profilePicture || ''
    sessionStorage.setItem('user', JSON.stringify(updated))
    window.dispatchEvent(new Event('carecircle:profile-updated'))
    success.value = 'Your profile picture has been updated.'
  } catch (e) { error.value = e.response?.data?.message || 'Unable to update your profile picture. Please try again.' }
  finally { saving.value = false }
}
onMounted(loadProfile)
</script>
<template>
<div class="profile-page container-fluid">
  <div class="mb-4"><div class="profile-eyebrow mb-2">♡ YOUR LITTLE CORNER ♡</div>
    <h1 class="fw-bold mb-2">My Profile</h1><p class="text-secondary mb-0">A little space for you and your avatar.</p></div>
  <div v-if="loading" class="text-center py-5" role="status"><div class="spinner-border text-success"></div><p class="mt-3">Loading profile...</p></div>
  <template v-else-if="user">
    <div v-if="success" class="alert alert-success rounded-4" role="status">{{ success }}</div>
    <div class="row g-4 align-items-start">
      <div class="col-12 col-xl-7">
        <section class="profile-card bg-white rounded-4 p-4 mb-4">
          <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
            <ProfilePicturePicker :model-value="user.profilePicture || ''" :disabled="saving" @update:model-value="savePicture" />
            <div class="flex-grow-1"><h2 class="h4 fw-bold mb-1">{{ user.name }}</h2><p class="text-secondary small mb-1">{{ user.email }}</p><span class="profile-pill badge rounded-pill px-3 py-2"><i class="bi bi-heart-fill me-1"></i>CareCircle Member</span></div>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h5 fw-bold mb-0"><i class="bi bi-person-heart me-2 profile-green"></i>Personal details</h3>
            <button v-if="!editing" type="button" class="btn btn-sm profile-outline rounded-pill px-3" @click="editing=true;success=''"> <i class="bi bi-pencil-square me-1"></i>Edit</button>
          </div>
          <form @submit.prevent="saveProfile"><div class="row g-3">
            <div class="col-12"><label for="pName" class="form-label fw-semibold small">Full name</label><input id="pName" v-model="form.name" class="form-control rounded-3" minlength="2" maxlength="80" required :disabled="!editing" /></div>
            <div class="col-12"><label for="pEmail" class="form-label fw-semibold small">Email address</label><input id="pEmail" :value="user.email" type="email" class="form-control rounded-3" disabled /><div class="form-text">Your email cannot be changed here.</div></div>
            <div class="col-12 col-md-6"><label for="pPhone" class="form-label fw-semibold small">Phone number</label><input id="pPhone" v-model="form.phone" type="tel" maxlength="30" class="form-control rounded-3" :disabled="!editing" placeholder="Not added yet" /></div>
            <div class="col-12 col-md-6"><label for="pLang" class="form-label fw-semibold small">Preferred language</label><select id="pLang" v-model="form.preferredLang" class="form-select rounded-3" :disabled="!editing"><option v-for="(label,code) in languages" :key="code" :value="code">{{ label }}</option></select></div>
            <div class="col-12"><label for="pTelegram" class="form-label fw-semibold small">Telegram username</label><div class="input-group"><span class="input-group-text">@</span><input id="pTelegram" v-model="form.telegramUsername" maxlength="32" class="form-control" :disabled="!editing" placeholder="username" /></div></div>
            <div class="col-12"><div class="caretaker-option p-3 rounded-4"><div class="form-check d-flex align-items-start gap-2 mb-0"><input id="pCaretaker" v-model="form.isCaretaker" type="checkbox" class="form-check-input mt-1" :disabled="!editing"/><label class="form-check-label" for="pCaretaker"><span class="fw-bold d-block"><i class="bi bi-heart-pulse me-1"></i>I'm also a caretaker</span><span class="d-block small text-secondary mt-1">I help care for a family member or loved one.</span></label></div></div></div>
          </div>
          <div v-if="error" class="alert alert-danger rounded-3 mt-3 mb-0" role="alert">{{ error }}</div>
          <div v-if="editing" class="d-flex gap-2 justify-content-end mt-4"><button type="button" class="btn btn-light rounded-pill px-4" :disabled="saving" @click="cancelEdit">Cancel</button><button type="submit" class="btn btn-success rounded-pill px-4 fw-bold" :disabled="saving">{{saving?'Saving...':'Save changes ♡'}}</button></div>
          </form>
        </section>
        <section class="profile-card bg-white rounded-4 p-4"><h3 class="h5 fw-bold mb-3"><i class="bi bi-shield-check me-2 profile-green"></i>Account information</h3><div class="d-flex justify-content-between gap-2 flex-wrap"><span class="text-secondary small">Member since</span><strong class="small">{{user.createdAt?new Date(user.createdAt).toLocaleDateString('en-SG',{day:'numeric',month:'long',year:'numeric'}):'—'}}</strong></div><hr/><div class="d-flex justify-content-between flex-wrap gap-2"><span class="text-secondary small">Account type</span><strong class="small">CareCircle member</strong></div></section>
      </div>
      <div class="col-12 col-xl-5"><section class="profile-card bg-white rounded-4 p-4">
        <div class="text-center mb-3"><span class="profile-eyebrow">♡ MY LITTLE SELF ♡</span><h2 class="h4 fw-bold mt-3 mb-2">My Avatar</h2><p class="text-secondary small mb-0">A little digital version of you! ♡</p></div>
        <div class="pet-display rounded-4 p-3 text-center"><AvatarPreview :appearance="avatarAppearance" /></div>
        <div class="d-grid mt-3"><RouterLink to="/avatar-studio" class="btn profile-primary rounded-pill py-3 fw-bold"><i class="bi bi-stars me-2"></i>Customize avatar</RouterLink></div>
        <p class="small text-secondary text-center mt-3 mb-0">Mix and match outfits to express your style. Your saved look appears here! ♡</p>
      </section></div>
    </div>
  </template>
  <div v-else class="alert alert-danger" role="alert">{{error||'Unable to load profile.'}} <button type="button" class="btn btn-sm btn-outline-danger ms-2" @click="loadProfile">Try again</button></div>
</div>
</template>
