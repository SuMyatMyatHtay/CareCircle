
<script setup>
import { ref, computed } from 'vue'
import '../../styles/components/familySidebar.css'

const props = defineProps({
    families: { type: Array, default: () => [] },
    selectedFamilyId: { type: String, default: '' },
    user: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['select-family'])

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
    showSwitcher.value = false
}
</script>

<template>
    <aside class="family-sidebar">
        <RouterLink to="/home" class="sidebar-brand">
        <span class="brand-icon">
            <i class="bi bi-heart-pulse"></i>
        </span>
        CareCircle
        </RouterLink>

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
            <small v-if="selectedFamily">
                {{ memberCount }} {{ memberCount === 1 ? 'member' : 'members' }}
                · {{ selectedFamily.inviteCode }}
            </small>
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

            <RouterLink to="/create-family" class="switcher-action">
            <i class="bi bi-plus-lg"></i> Create a new family
            </RouterLink>

            <RouterLink to="/join-family" class="switcher-action">
            <i class="bi bi-person-plus"></i> Join with invite code
            </RouterLink>
        </div>
        </div>

        <!-- NAVIGATION -->
        <nav class="sidebar-nav" aria-label="Family navigation">
        <RouterLink to="/home" class="nav-item active">
            <i class="bi bi-house-door"></i>
            Family home
        </RouterLink>

        <template v-if="selectedFamily">
            <div class="nav-item unavailable">
            <i class="bi bi-list-check"></i>
            My tasks <span class="coming-tag">Soon</span>
            </div>

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

        <div class="profile-row">
            <span class="profile-avatar">
            {{ user.name?.charAt(0)?.toUpperCase() || '?' }}
            </span>
            <span class="profile-details">
            <strong>{{ user.name || 'My Profile' }}</strong>
            <small v-if="selectedFamily">{{ userRole }}</small>
            <small v-else>Welcome to CareCircle</small>
            </span>
        </div>
        </div>
    </aside>
</template>

