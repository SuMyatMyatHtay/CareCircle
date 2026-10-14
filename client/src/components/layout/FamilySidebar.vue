
<script setup>
import { ref, computed } from 'vue'
import '../../styles/components/familySidebar.css'
import { useRouter } from 'vue-router'
import {
  logoutUser,
  clearUserSession
} from '../../features/auth/services/authApi.js'

const router = useRouter() 
const isLoggingOut = ref(false)
const logoutError = ref('')
const copiedInviteCode = ref('')

const props = defineProps({
    families: { type: Array, default: () => [] },
    selectedFamilyId: { type: String, default: '' },
    user: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['select-family', 'navigate', 'collapse'])

const showSwitcher = ref(false)

const selectedFamily = computed(() =>
    props.families.find(f => f.id === props.selectedFamilyId)
)

const memberCount = computed(() =>
    selectedFamily.value?.members?.length ?? 0
)

const userRole = computed(() => {
    const userId = props.user.id
    return selectedFamily.value?.members
        ?.find(member => member.userId === userId)?.role || 'member'
})

function selectFamily(familyId) {
    emit('select-family', familyId)
    emit('navigate')
    showSwitcher.value = false
}

async function copyInviteCode(inviteCode) {
    if (!inviteCode) return

    try {
        await navigator.clipboard.writeText(inviteCode)
        copiedInviteCode.value = inviteCode

        setTimeout(() => {
            if (copiedInviteCode.value === inviteCode) {
                copiedInviteCode.value = ''
            }
        }, 1500)
    } catch (error) {
        console.error('Failed to copy invite code:', error)
    }
}

async function handleLogout(){ 
    if(isLoggingOut.value){ 
        return
    }
    isLoggingOut.value = true
    logoutError.value = ""

    try{ 
        await logoutUser()
        clearUserSession() 
        await router.replace('/login')
    } catch(error){ 
        if(error.response?.status === 401){ 
            clearUserSession()
            await router.replace('/login')
            return
        }

        console.error('Logout failed: ', error)
        logoutError.value = "Unable to log out. Please try again."
    } finally { 
        isLoggingOut.value = false
    }
}

</script>

<template>
    <aside class="family-sidebar">
        <div class="d-flex align-items-center justify-content-between mb-4">
            <RouterLink to="/home" class="sidebar-brand mb-0">
                <span class="brand-icon">
                <i class="bi bi-heart-pulse"></i>
                </span>
                CareCircle
            </RouterLink>

            <button
                type="button"
                class="btn btn-sm sidebar-collapse-button"
                aria-label="Hide sidebar"
                @click="emit('collapse')"
            >
                <i class="bi bi-layout-sidebar-inset-reverse"></i>
            </button>
        </div>

        <!-- FAMILY SWITCHER -->
        <div class="switcher-container">
        <button
            class="family-selector"
            type="button"
            :aria-expanded="showSwitcher"
            @click="showSwitcher = !showSwitcher"
        >
            <span>
            <strong>{{ selectedFamily?.name || 'My Families' }}</strong>
            <div v-if="selectedFamily" class="family-selector-meta">
                <small>
                    {{ memberCount }} {{ memberCount === 1 ? 'member' : 'members' }}
                </small>

                <span
                    class="invite-code-chip"
                    role="button"
                    tabindex="0"
                    title="Click to copy invite code"
                    @click.stop="copyInviteCode(selectedFamily.inviteCode)"
                >
                    <i
                        class="bi"
                        :class="copiedInviteCode === selectedFamily.inviteCode ? 'bi-check2' : 'bi-copy'"
                    ></i>
                    {{ copiedInviteCode === selectedFamily.inviteCode ? 'Copied!' : selectedFamily.inviteCode }}
                </span>
            </div>
            <small v-else>No family selected</small>
            </span>
            <i class="bi bi-chevron-down"></i>
        </button>

        <div v-if="showSwitcher" class="switcher-menu">
            <div class="menu-label">YOUR FAMILIES</div>

            <button
            v-for="family in families"
            :key="family.id"
            class="family-option"
            :class="{ selected: family.id === selectedFamilyId }"
            @click="selectFamily(family.id)"
            >
            <span class="family-symbol">🏡</span>
            <span class="family-option-text">
                <strong>{{ family.name }}</strong>
                <small>
                {{ family.members?.length || 0 }} members
                </small>
            </span>
            <i
                v-if="family.id === selectedFamilyId"
                class="bi bi-check-lg"
            ></i>
            </button>

            <div class="switcher-divider"></div>

            <RouterLink to="/create-family" class="switcher-action" >
            <i class="bi bi-plus-lg"></i> Create a new family
            </RouterLink>

            <RouterLink to="/join-family" class="switcher-action">
            <i class="bi bi-person-plus"></i> Join with invite code
            </RouterLink>
        </div>
        </div>

        <!-- NAVIGATION -->
        <nav class="sidebar-nav overflow-y-auto" aria-label="Family navigation">
        <RouterLink to="/home" class="nav-item " active-class="active" @click="emit('navigate')">
            <i class="bi bi-house-door"></i>
            Family home
        </RouterLink>

        <template v-if="selectedFamily">
            <RouterLink to="/my-tasks" class="nav-item" active-class="active" @click="emit('navigate')">
            <i class="bi bi-list-check"></i>
            My tasks
            </RouterLink>

            <div class="nav-item unavailable">
            <i class="bi bi-calendar3"></i>
            Calendar <span class="coming-tag">Soon</span>
            </div>

            <div class="nav-heading">CARE RECIPIENTS</div>
            <p class="empty-recipients">
            No care recipients yet.
            </p>

            <div class="nav-item unavailable">
            <i class="bi bi-plus-lg"></i>
            Add care recipient
            <span class="coming-tag">Soon</span>
            </div>
        </template>
        </nav>

        <!-- BOTTOM AREA -->
        <div class="sidebar-bottom">
            <div v-if="selectedFamily" class="nav-item unavailable">
                <i class="bi bi-gear"></i>
                Family settings
                <span class="coming-tag">Soon</span>
            </div>
            <RouterLink to="/profile" class="nav-item" active-class="active" @click="emit('navigate')">
                <i class="bi bi-person-circle"></i>
                My profile
            </RouterLink>

            <RouterLink
                to="/profile"
                class="profile-row text-decoration-none text-reset"
                >
                <span class="profile-avatar">
                {{ user.name?.charAt(0)?.toUpperCase() || '?' }}
                </span>
                <span class="profile-details">
                <strong>{{ user.name || 'My Profile' }}</strong>
                <small v-if="selectedFamily">{{ userRole }}</small>
                <small v-else>Welcome to CareCircle</small>
                </span>
            </RouterLink>
            <button
                type="button"
                class="logout-button"
                :disabled="isLoggingOut"
                @click="handleLogout"
                >
                <i class="bi bi-box-arrow-right"></i>
                {{ isLoggingOut ? 'Logging out...' : 'Log out' }}
            </button>

            <p v-if="logoutError" class="logout-error" role="alert">
                {{ logoutError }}
            </p>
        </div>
    </aside>
</template>

