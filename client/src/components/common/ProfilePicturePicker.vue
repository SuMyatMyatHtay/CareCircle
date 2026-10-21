<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue'
import CareAvatar from './CareAvatar.vue'
import { profilePictures } from './profilePictures.js'
const props = defineProps({ modelValue: { type: String, default: '' }, careType: { type: String, default: '' }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const error = ref('')
const dialog = ref(null), trigger = ref(null), fileInput = ref(null)
const draft = ref(''), processing = ref(false)
let uploadVersion = 0
async function open() {
  if (props.disabled) return
  draft.value = props.modelValue
  error.value = ''
  await nextTick()
  dialog.value.showModal()
}
function close() {
  uploadVersion++
  processing.value = false
  dialog.value?.close()
  trigger.value?.focus()
}
function apply() {
  if (props.disabled || processing.value) return
  emit('update:modelValue', draft.value)
  close()
}
onBeforeUnmount(() => { uploadVersion++; dialog.value?.close() })
async function upload(event) {
  error.value = ''
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    error.value = 'Choose a JPG, PNG or WebP image under 10 MB.'; return
  }
  const version = ++uploadVersion
  processing.value = true
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 160
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 160, 160)
    const side = Math.min(image.width, image.height)
    ctx.drawImage(image, (image.width-side)/2, (image.height-side)/2, side, side, 0, 0, 160, 160)
    const data = canvas.toDataURL('image/jpeg', 0.8)
    if (data.length > 50000) throw new Error('Image too large')
    if (version === uploadVersion && !props.disabled) draft.value = data
  } catch { if (version === uploadVersion) error.value = 'Unable to read this image. Please try another picture.' }
  finally { URL.revokeObjectURL(url); if (version === uploadVersion) processing.value = false }
}
</script>
<template>
  <button ref="trigger" type="button" class="picture-trigger" :disabled="disabled" aria-label="Change profile picture" aria-haspopup="dialog" @click="open">
    <CareAvatar :person="{ profilePicture: modelValue, careType }" size="profile" />
    <span class="picture-camera"><i class="bi bi-camera-fill" aria-hidden="true"></i></span>
  </button>
  <Teleport to="body">
    <dialog ref="dialog" class="picture-dialog" aria-label="Change profile picture" @cancel.prevent.stop="close" @keydown.esc.stop.prevent="close" @click="($event.target === dialog) && close()">
      <div class="picture-panel">
        <header class="picture-heading">
          <div><h2>Profile picture</h2><p>A familiar face for your circle.</p></div>
          <button type="button" class="picture-close" aria-label="Close picture editor" @click="close"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </header>
        <div class="picture-preview"><CareAvatar :person="{ profilePicture: draft, careType }" size="preview" /></div>
        <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="picture-file" tabindex="-1" aria-label="Upload a profile picture" @change="upload" />
        <button type="button" class="picture-upload" :disabled="processing || disabled" @click="fileInput.click()"><i class="bi bi-upload" aria-hidden="true"></i>{{ processing ? 'Preparing photo?' : 'Upload a photo' }}</button>
        <p class="picture-hint">JPG, PNG or WebP ? Up to 10 MB</p>
        <div class="picture-divider"><span>or choose an avatar</span></div>
        <div class="picture-grid">
          <button v-for="picture in profilePictures" :key="picture.src" type="button" class="picture-option" :class="{ selected: draft === picture.src }" :aria-label="picture.label" :aria-pressed="draft === picture.src" :disabled="processing" @click="draft = picture.src">
            <img :src="picture.src" alt="" />
            <span v-if="draft === picture.src" class="picture-check"><i class="bi bi-check" aria-hidden="true"></i></span>
          </button>
        </div>
        <button type="button" class="picture-reset" :disabled="processing" @click="draft = ''">Use default picture</button>
        <p v-if="error" class="picture-error" role="alert">{{ error }}</p>
        <footer class="picture-footer">
          <button type="button" class="picture-cancel" @click="close">Cancel</button>
          <button type="button" class="picture-apply" :disabled="processing || disabled" @click="apply">Use picture</button>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>
<style scoped>
.picture-trigger { position: relative; display: inline-flex; flex-shrink: 0; border: 0; padding: 0; border-radius: 50%; background: none; cursor: pointer; }
.picture-trigger:focus-visible { outline: 3px solid #398663; outline-offset: 6px; }
.picture-trigger:disabled { opacity: .65; cursor: wait; }
.picture-camera { position: absolute; bottom: 2px; right: 0; display: grid; place-items: center; width: 32px; height: 32px; border: 3px solid var(--theme-panel, #fff); border-radius: 50%; background: #246e58; color: white; font-size: 14px; box-shadow: 0 2px 6px #193b2920; }
.picture-dialog { padding: 0; border: 1px solid var(--theme-border, #e4ece5); border-radius: 24px; width: min(440px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; background: var(--theme-panel, #fff); color: var(--theme-text, #21312c); box-shadow: 0 24px 90px #142f3533; }
.picture-dialog::backdrop { background: #172b2766; backdrop-filter: blur(4px); }
.picture-panel { padding: 26px; }
.picture-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.picture-heading h2 { margin: 0 0 6px; font-size: 22px; font-weight: 750; }
.picture-heading p, .picture-hint { color: var(--theme-muted, #6d7b75); font-size: 13px; margin: 0; }
.picture-close { border: 0; background: var(--theme-neutral, #f4f6f3); color: inherit; width: 32px; height: 32px; border-radius: 50%; }
.picture-preview { display: flex; justify-content: center; margin: 24px 0 20px; }
.picture-file { display: none; }
.picture-upload { width: 100%; display: flex; justify-content: center; align-items: center; gap: 9px; padding: 11px 16px; border: 1px solid var(--theme-border, #dce7df); background: var(--theme-panel, #fff); border-radius: 12px; color: var(--theme-green, #246e58); font-weight: 650; }
.picture-upload:hover { background: var(--theme-soft, #eef7f0); }
.picture-hint { text-align: center; margin-top: 9px; font-size: 11px; }
.picture-divider { display: flex; align-items: center; gap: 12px; margin: 23px 0 16px; font-size: 12px; color: var(--theme-muted, #6d7b75); }
.picture-divider::before, .picture-divider::after { content: ''; flex: 1; height: 1px; background: var(--theme-border, #e4ece5); }
.picture-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.picture-option { position: relative; padding: 3px; width: 100%; border: 2px solid transparent; border-radius: 50%; background: var(--theme-soft, #f0f6ef); transition: border-color .15s, transform .15s; }
.picture-option:hover { transform: translateY(-2px); border-color: #a1c7ab; }
.picture-option.selected { border-color: #246e58; }
.picture-option img { display: block; width: 100%; aspect-ratio: 1; border-radius: 50%; object-fit: cover; }
.picture-check { position: absolute; bottom: -2px; right: -2px; width: 22px; height: 22px; border-radius: 50%; background: #246e58; color: white; border: 2px solid var(--theme-panel, white); display: grid; place-items: center; }
.picture-reset { display: block; margin: 17px auto 0; padding: 4px; border: 0; background: none; font-size: 12px; color: var(--theme-muted, #6d7b75); text-decoration: underline; text-underline-offset: 3px; }
.picture-error { margin-top: 12px; font-size: 13px; color: #b34343; }
.picture-footer { display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--theme-border, #e4ece5); margin-top: 22px; padding-top: 18px; }
.picture-footer button { padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 650; }
.picture-cancel { background: var(--theme-panel, white); border: 1px solid var(--theme-border, #dce7df); color: inherit; }
.picture-apply { background: #246e58; color: white; border: 1px solid #246e58; }
button:disabled { opacity: .6; cursor: wait; }
@media(max-width: 420px) { .picture-panel { padding: 20px; } .picture-grid { gap: 10px; } }
</style>
