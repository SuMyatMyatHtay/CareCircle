
<script setup>
import { ref, computed } from 'vue'

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

<style scoped>
.family-sidebar {
    width: 264px;
    flex-shrink: 0;
    min-height: 100vh;
    background: #fff;
    border-right: 1px solid #E5E7EB;
    display: flex;
    flex-direction: column;
    padding: 22px 16px 18px;
    color: #2F2F2F;
}

.sidebar-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    font-size: 19px;
    font-weight: 850;
    color: #2F2F2F;
    text-decoration: none;
    margin: 0 8px 23px;
}

.brand-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: #2E7D43;
    color: white;
    font-size: 18px;
}

.switcher-container { position: relative; }

.family-selector {
    width: 100%;
    border: 1px solid #E1E5E9;
    background: #FCFBF8;
    border-radius: 12px;
    padding: 11px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
    color: #2F2F2F;
}

.family-selector strong,
.family-selector small {
    display: block;
}

.family-selector strong { font-size: 13px; }
.family-selector small {
    font-size: 11px;
    color: #7A8391;
    margin-top: 3px;
}

.switcher-menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + 7px);
    left: 0;
    width: 300px;
    max-width: calc(100vw - 32px);
    background: white;
    border: 1px solid #E6E8EA;
    box-shadow: 0 14px 35px #273C3030;
    border-radius: 15px;
    padding: 9px;
}

.menu-label, .nav-heading {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .4px;
    color: #7C8594;
    padding: 8px 10px;
}

.family-option {
    border: 0;
    width: 100%;
    background: transparent;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px;
    text-align: left;
}

.family-option.selected { background: #E8F5E9; }
.family-option:hover { background: #F0F7F1; }

.family-symbol {
    font-size: 20px;
}

.family-option-text { flex: 1; }
.family-option-text strong,
.family-option-text small { display: block; }
.family-option-text strong { font-size: 13px; }
.family-option-text small { font-size: 11px; color: #7A8391; }
.family-option .bi-check-lg { color: #2E7D43; }

.switcher-divider {
    border-top: 1px solid #EDF0ED;
    margin: 7px 0;
}

.switcher-action {
    display: flex;
    gap: 12px;
    padding: 11px;
    text-decoration: none;
    color: #2E7D43;
    font-size: 13px;
    font-weight: 700;
    border-radius: 8px;
}

.switcher-action:hover { background: #F0F7F1; }

.sidebar-nav {
    flex: 1;
    padding-top: 20px;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 11px 13px;
    border-radius: 10px;
    font-size: 13px;
    color: #454545;
    text-decoration: none;
    margin-bottom: 3px;
}

.nav-item i { font-size: 17px; }
.nav-item.active {
    background: #E8F5E9;
    color: #2D7E42;
    font-weight: 800;
}

.nav-item.unavailable { color: #8B929B; }

.coming-tag {
    margin-left: auto;
    font-size: 10px;
    color: #9DA4AB;
}

.nav-heading { margin-top: 17px; }

.empty-recipients {
    padding: 8px 13px;
    color: #98A09B;
    font-size: 12px;
}

.sidebar-bottom {
    margin-top: auto;
}

.profile-row {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 15px 10px 0;
    margin-top: 10px;
    border-top: 1px solid #E5E7EB;
}

.profile-avatar {
    width: 35px;
    height: 35px;
    border-radius: 50%;
    background: #E1F3E5;
    color: #2E7D43;
    display: grid;
    place-items: center;
    font-weight: 850;
}

.profile-details strong,
.profile-details small { display: block; }
.profile-details strong { font-size: 13px; }
.profile-details small {
    font-size: 11px;
    color: #7A8391;
    text-transform: capitalize;
}

@media (max-width: 767px) {
    .fam  ily-sidebar {
        width: 100%;
        min-height: auto;
        border-right: none;
        border-bottom: 1px solid #E5E7EB;
    }

    .sidebar-nav { padding-top: 10px; }
    .sidebar-bottom { margin-top: 5px; }
}
</style>
